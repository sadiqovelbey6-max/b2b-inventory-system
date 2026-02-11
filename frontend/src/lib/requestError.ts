import axios from 'axios';

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.response?.data?.detail ??
      error.message;
    return typeof message === 'string' ? message : 'Sorğu zamanı xəta baş verdi.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Naməlum xəta baş verdi.';
};

export default getErrorMessage;

