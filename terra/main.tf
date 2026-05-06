# IAM role for Lambda execution
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.app_name}_lambda_execution_role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/${var.app_name}_lamda_function"
  retention_in_days = 14
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_lambda_function" "honyaku-lambda" {
  function_name = "${var.app_name}_lamda_function"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "034817877835.dkr.ecr.ap-southeast-2.amazonaws.com/samdietz/honyaku:latest"

  memory_size = 512
  timeout     = 30

  architectures = ["x86_64"] # Graviton support for better price/performance

  environment {
    variables = {
      CHANNEL_ACCESS_TOKEN = var.channel_access_token
      GROQ_API_KEY         = var.groq_api_key
    }
  }
}

# HTTP API Gateway
resource "aws_apigatewayv2_api" "honyaku_api" {
  name          = "${var.app_name}_api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.honyaku_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.honyaku-lambda.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default_route" {
  api_id    = aws_apigatewayv2_api.honyaku_api.id
  route_key = "POST /webhook"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.honyaku_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.honyaku-lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.honyaku_api.execution_arn}/*/*/webhook"
}

