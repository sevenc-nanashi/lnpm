import { error } from "~/message";

type SuccessResult<T> = {
  success: true;
  value: T;
};

type FailureResult = {
  success: false;
  message: string;
};

export type Result<T> = SuccessResult<T> | FailureResult;

export const success = <T>(value: T): SuccessResult<T> => ({
  success: true,
  value,
});

export const failure = (message: string): FailureResult => ({
  success: false,
  message,
});
export const isAllSuccess = <T>(
  results: Result<T>[]
): results is SuccessResult<T>[] => results.every((result) => result.success);

export const handleResults = <T>(results: Result<T>[]): T[] => {
  if (isAllSuccess(results)) {
    return results.map((result) => result.value);
  } else {
    const errors = results.filter(
      (result) => !result.success
    ) as FailureResult[];
    errors.forEach((err) => error(err.message));
    process.exit(1);
  }
};
