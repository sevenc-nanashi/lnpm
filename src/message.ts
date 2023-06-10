import chalk from "chalk";

export const info = (message: string) => {
  console.log(chalk.blue("i) ") + message);
};

export const shell = (args: string[]) => {
  console.log(
    chalk.dim("$) ") +
      args[0] +
      " " +
      args
        .slice(1)
        .map((arg) => JSON.stringify(arg))
        .join(" ")
  );
};

export const warn = (message: string) => {
  console.log(chalk.yellow("!) ") + message);
};

export const error = (message: string) => {
  console.log(chalk.red("!) ") + message);
};
