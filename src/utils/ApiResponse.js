class ApiResponse{

    constructor(
        statucCode,
        data,
        message="Success"
    ){
        this.statucCode = statucCode,
        this.data = data,
        message = message
        this.success = statucCode < 400
    }
}