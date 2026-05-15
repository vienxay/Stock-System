export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errors?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(msg = 'ບໍ່ພົບຂໍ້ມູນ')        { return new AppError(msg, 404); }
  static badRequest(msg: string, e?: unknown)  { return new AppError(msg, 400, e); }
  static unauthorized(msg = 'Unauthorized')    { return new AppError(msg, 401); }
  static forbidden(msg = 'ບໍ່ມີສິດໃຊ້ງານ')      { return new AppError(msg, 403); }
}
