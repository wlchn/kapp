import { differenceInMinutes } from "date-fns";

export const ID = (): string => {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return (
    "_" +
    Math.random()
      .toString(36)
      .substr(2, 9)
  );
};

export const randomName = (): string => {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return Math.random()
    .toString(36)
    .substr(2, 9);
};

export const formatTimeDistance = (t: any) => {
  let minutes = differenceInMinutes(new Date(), t);
  if (minutes <= 1) {
    return "1m";
  }
  const day = Math.floor(minutes / 1440);
  const hour = Math.floor((minutes - day * 1440) / 60);
  minutes = minutes - day * 1440 - hour * 60;
  let res = "";

  if (day > 0) {
    res += `${day}d`;
  }

  if (hour > 0) {
    res += `${hour}h`;
  }

  if (minutes > 0) {
    res += `${minutes}m`;
  }
  return res;
};
