provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# 1. Cloudflare Zone for the custom domain
resource "cloudflare_zone" "joli_to" {
  account_id = var.cloudflare_account_id
  zone       = var.domain_name
  plan       = "free"
  type       = "full"
  jump_start = false
}

# 2. Optimal zone security and performance defaults
resource "cloudflare_zone_settings_override" "joli_to" {
  zone_id = cloudflare_zone.joli_to.id

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    brotli                   = "on"
    early_hints              = "on"
    min_tls_version          = "1.2"
    ssl                      = "strict"
    tls_1_3                  = "on"
  }
}

# 3. Attach apex custom domain (joli.to) to Jolito Worker
resource "cloudflare_workers_custom_domain" "apex" {
  account_id = var.cloudflare_account_id
  hostname   = var.domain_name
  service    = var.worker_name
  zone_id    = cloudflare_zone.joli_to.id
}

# 4. Proxied DNS record for www subdomain
resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.joli_to.id
  name    = "www"
  content = "100::"
  type    = "AAAA"
  proxied = true
}

# 5. Permanent 301 redirect from www.joli.to/* to https://joli.to/*
resource "cloudflare_page_rule" "www_redirect" {
  zone_id  = cloudflare_zone.joli_to.id
  target   = "*www.${var.domain_name}/*"
  priority = 1
  status   = "active"

  actions {
    forwarding_url {
      url         = "https://${var.domain_name}/$2"
      status_code = 301
    }
  }
}


