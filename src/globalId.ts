let idCounter = 0;

export const generateId = (): string => {
  idCounter += 1;
  return idCounter.toString();
};
