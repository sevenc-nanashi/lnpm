import { PackageJson } from "@npmcli/package-json";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { shell } from "./message";

export const getPackageJsonDir = async (cwd: string) => {
  const splitPath = cwd.split(path.sep);
  while (splitPath.length > 0) {
    const packageJsonPath = path.join(splitPath.join(path.sep), "package.json");
    try {
      await fs.stat(packageJsonPath);
      return splitPath.join(path.sep);
    } catch (err) {
      splitPath.pop();
    }
  }
  return undefined;
};

export const isTypedProject = (packageJson: PackageJson) => {
  const { dependencies = {}, devDependencies = {} } = packageJson;
  const allDependencies = { ...dependencies, ...devDependencies };
  return ["typescript", "ts-node"].some((pkg) => pkg in allDependencies);
};

export const runCommand = async (
  commands: Record<"npm" | "yarn" | "pnpm", string[]>
) => {
  const dir = await getPackageJsonDir(process.cwd());
  if (!dir) {
    return;
  }
  let commandsToRun: string[] = [];
  if (await fs.stat(path.join(dir, "yarn.lock")).catch(() => false)) {
    commandsToRun = commands.yarn;
  } else if (
    await fs.stat(path.join(dir, "pnpm-lock.yaml")).catch(() => false)
  ) {
    commandsToRun = commands.pnpm;
  } else {
    commandsToRun = commands.npm;
  }

  shell(commandsToRun);
  const child = spawn(commandsToRun[0], commandsToRun.slice(1), {
    cwd: dir,
    stdio: "inherit",
  });
  await new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(code);
      }
    });
  });
};

export const toTypesPackageName = (packageName: string) => {
  if (packageName.match(/^@.*\/.*$/)) {
    return `@types/${packageName.replace(/^@/, "").replace(/\//, "__")}`;
  }
  return `@types/${packageName}`;
};
