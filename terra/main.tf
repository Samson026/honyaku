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

resource "aws_lambda_function" "honyaku-lambda" {
  function_name = "${var.app_name}_lamda_function"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "034817877835.dkr.ecr.ap-southeast-2.amazonaws.com/samdietz/honyaku:latest"

  image_config {
    entry_point = ["/lambda-entrypoint.sh"]
    command     = ["app.handler"]
  }

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