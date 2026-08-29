//message,status code,error codes, error

export class HttpException extends Error {
    status: number;
    message: string;
    errorCode: ErrorCode;
    errors:any;
    
    constructor(message:string,errorCode:ErrorCode,statusCode?:number,error?:any){
        super(message);
        this.status=statusCode ?? 500;
        this.message=message;
        this.errorCode=errorCode;
        if(error) this.errors=error;
    }
}

export enum ErrorCode{
    USER_NOT_FOUND = 1001,
    USER_ALREADY_EXISTS = 1002,
    INCORRECT_CREDENTIALS = 1003,
    UNPROCESSABLE_ENTITY = 2001,
    TOKEN_ERROR=2003,
    INTERNAL_EXCEPTION=3001,
    UNAUTHORIZED=3003
}
