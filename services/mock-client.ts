let failNext = false;
let sequence = 300;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function setNextRequestShouldFail(value = true) {
  failNext = value;
}

export async function mockRequest<T>(factory: () => T, delay = 650): Promise<T> {
  await sleep(delay);
  if (failNext) {
    failNext = false;
    throw new Error("Mock generation failed. Your existing strategy is unchanged.");
  }
  return factory();
}

export function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}
