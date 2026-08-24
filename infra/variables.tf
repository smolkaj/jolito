variable "cloudflare_api_token" {
  description = "Cloudflare API Token with Zone:Edit, Worker:Edit, and DNS:Edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "domain_name" {
  description = "Apex domain name for Jolito"
  type        = string
  default     = "joli.to"
}

variable "worker_name" {
  description = "Name of the Cloudflare Worker"
  type        = string
  default     = "jolito"
}
