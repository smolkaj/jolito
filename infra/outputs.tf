output "zone_id" {
  description = "Cloudflare Zone ID"
  value       = cloudflare_zone.joli_to.id
}

output "nameservers" {
  description = "Assigned Cloudflare Nameservers to configure in Spaceship.com"
  value       = cloudflare_zone.joli_to.name_servers
}

output "custom_domains" {
  description = "Configured Cloudflare Worker custom domains"
  value = [
    cloudflare_workers_custom_domain.apex.hostname,
    cloudflare_workers_custom_domain.www.hostname
  ]
}
