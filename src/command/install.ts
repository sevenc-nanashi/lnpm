import { program } from "commander";
import axios from "axios";
import semver from "semver";
import pacote from "pacote";
import PackageJson from "@npmcli/package-json";
import { error, info, warn } from "~/message";
import { failure, handleResults, Result, success } from "~/result";
import {
  getPackageJsonDir,
  isTypedProject,
  runCommand,
  toTypesPackageName,
} from "~/utils";

const options = program.opts();

type Package = {
  name: string;
  isDev: boolean;
  version: string;
};
type ResolvedPackage = {
  name: string;
  isDev: boolean;
  version: semver.SemVer;
  typed: boolean;
};

const parsePackage = (pkg: string, isDevOption: boolean): Result<Package> => {
  let isDev = false;
  if (pkg.startsWith("dev:")) {
    if (isDevOption) {
      warn(`dev: prefix is ignored when -D or --dev is specified`);
    }
    isDev = true;
  } else {
    isDev = isDevOption;
  }
  const packageMatch = pkg.match(/^(dev:)?(.+?)(?:@(.+))?$/);
  if (!packageMatch) {
    return failure(`Invalid package name: ${pkg}`);
  }
  const [, , packageName, version] = packageMatch;
  return success({ name: packageName, isDev, version: version ?? "*" });
};

const resolvePackageVersion = async (
  pkg: Package
): Promise<Result<semver.SemVer>> => {
  const packument = await pacote.packument(pkg.name);

  const version = pkg.version;
  let resolvedVersion: string;
  if (!version || version === "latest") {
    resolvedVersion = packument["dist-tags"].latest;
  } else if (!semver.validRange(version)) {
    const distTag = packument["dist-tags"][version];
    if (distTag) {
      resolvedVersion = distTag;
    } else {
      return failure(`Tag ${version} not found for ${pkg.name}`);
    }
  } else {
    const versions = Object.keys(packument.versions);
    const maxVersion = semver.maxSatisfying(versions, version);
    if (maxVersion) {
      resolvedVersion = maxVersion;
    } else {
      return failure(`Version ${version} not found for ${pkg.name}`);
    }
  }
  const parsedVersion = semver.parse(resolvedVersion);
  if (!parsedVersion) {
    return failure(`Invalid version: ${resolvedVersion}`);
  }
  return success(parsedVersion);
};

const getDtsPackage = async (pkg: ResolvedPackage) => {
  const typesPackageName = toTypesPackageName(pkg.name);
  const typesPackage = `${typesPackageName}@~${pkg.version.major}`;
  const typesPackageInfo = await pacote
    .manifest(typesPackage)
    .catch(() => undefined);
  if (!typesPackageInfo) {
    warn(`${pkg.name} is not typed, but ${typesPackageName} is not found`);
    return;
  }
  const typesPackageVersion = semver.parse(
    typesPackageInfo.version
  ) as semver.SemVer;

  return {
    name: typesPackageName,
    isDev: true,
    typed: true,
    version: typesPackageVersion,
  };
};

const addPackage = async (packages: string[]) => {
  const packageJsonPath = await getPackageJsonDir(process.cwd());
  if (!packageJsonPath) {
    error(`package.json not found`);
    return;
  }
  const basePackageJson = await PackageJson.load(packageJsonPath);
  const isDevOption = !!(options.dev || options.D);
  const packageNames = handleResults(
    packages.map((pkg) => parsePackage(pkg, isDevOption))
  );
  info(`Resolving ${packageNames.length} packages...`);
  const resolvedPackageVersions: semver.SemVer[] = handleResults(
    await Promise.all(packageNames.map(resolvePackageVersion))
  );
  const resolvedPackages: ResolvedPackage[] = await Promise.all(
    packageNames.map(async (pkg, index) => {
      const version = resolvedPackageVersions[index];
      return {
        name: pkg.name,
        isDev: pkg.isDev,
        typed: await axios
          .get(`https://registry.npmjs.org/${pkg.name}/${version}`)
          .then((manifest) => {
            const { data } = manifest;
            return "types" in data || "typings" in data;
          }),
        version,
      };
    })
  );
  const typesPackages = isTypedProject(basePackageJson.content)
    ? await Promise.all(
        resolvedPackages
          .filter((pkg) => !pkg.name.startsWith("@types/"))
          .filter((pkg) => !pkg.isDev)
          .filter((pkg) => !pkg.typed)
          .map(getDtsPackage)
      ).then((packages) => packages.filter((pkg) => pkg) as ResolvedPackage[])
    : [];

  basePackageJson.update({
    dependencies: [...resolvedPackages]
      .filter((pkg) => !pkg.isDev)
      .reduce((dependency, pkg) => {
        dependency[pkg.name] = pkg.version.raw;
        return dependency;
      }, basePackageJson.content.dependencies ?? {}),
    devDependencies: [...resolvedPackages, ...typesPackages]
      .filter((pkg) => pkg.isDev)
      .reduce((devDependency, pkg) => {
        devDependency[pkg.name] = pkg.version.raw;
        return devDependency;
      }, basePackageJson.content.devDependencies ?? {}),
    peerDependencies: basePackageJson.content.peerDependencies,
    optionalDependencies: basePackageJson.content.optionalDependencies,
  });
  basePackageJson.save();
  info(
    `Installing ${resolvedPackages.length} + ${typesPackages.length} packages...`
  );
  for (const pkg of [...resolvedPackages].sort((a, b) =>
    a.isDev === b.isDev ? a.name.localeCompare(b.name) : a.isDev ? 1 : -1
  )) {
    const typesPackage = typesPackages.find(
      (typesPkg) => typesPkg.name === toTypesPackageName(pkg.name)
    );
    if (pkg.typed || !isTypedProject(basePackageJson.content)) {
      info(`  ${pkg.name}@${pkg.version.raw}`);
    } else if (typesPackage) {
      info(
        `  ${pkg.name}@${pkg.version.raw} + ${typesPackage.name}@${typesPackage.version.raw}`
      );
    } else {
      warn(`  ${pkg.name}@${pkg.version.raw} (not typed)`);
    }
  }
  await runCommand({
    npm: ["npm", "install"],
    yarn: ["yarn", "install"],
    pnpm: ["pnpm", "install"],
  });
};

const install = async (packages: string[]) => {
  if (packages.length === 0) {
    error(`No packages specified`);
    return;
  }
  await addPackage(packages);
};

export default install;
