variable "app_name" {
  type    = string
  default = "honyaku"
}

variable "channel_access_token" {
  type      = string
  sensitive = true
}

variable "groq_api_key" {
  type      = string
  sensitive = true
}