import { program } from "commander";
import addPackage from "./command/install";

program.version("0.0.1").name("lnpm").usage("<command> [options]");

program
  .command("install [name...]")
  .description("install package")
  .alias("i")
  .option("-D, --dev", "install devDependencies")
  .action(addPackage);

program.parse(process.argv);
