/**
 * Converts milliseconds into a human-readable time string.
 * For values less than 1 second, returns the time in milliseconds.
 * @param ms The time in milliseconds
 * @returns A human-readable time string
 */
export function readableTime(ms: number) {
  const totalSeconds = ms / 1000;

  if (totalSeconds >= 86400) {
    const days = Math.floor(totalSeconds / 86400);
    return days.toFixed(2) + (days === 1 ? " day" : " days");
  }
  // Otherwise, if there are at least 3600 seconds, show hours only.
  else if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    return hours.toFixed(2) + (hours === 1 ? " hour" : " hours");
  }
  // Otherwise, if there are at least 60 seconds, show minutes only.
  else if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    return minutes.toFixed(2) + (minutes === 1 ? " minute" : " minutes");
  }
  // Otherwise, if there is at least 1 second, show seconds.
  else if (totalSeconds >= 1) {
    return (
      totalSeconds.toFixed(2) + (totalSeconds === 1 ? " second" : " seconds")
    );
  }
  // Otherwise, show milliseconds.
  else {
    return ms.toFixed(0) + "ms";
  }
}
