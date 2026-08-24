# Jolito Cloudflare Infrastructure (Terraform)

This Terraform configuration manages the Cloudflare resources for Jolito:

- Cloudflare Zone for `joli.to`
- HTTPS, SSL (Strict), HTTP/3, TLS 1.3, and Brotli settings
- Cloudflare Worker Custom Domains for `joli.to` and `www.joli.to`

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/downloads) or [OpenTofu](https://opentofu.org/) (`>= 1.5.0`).
2. A Cloudflare account and API Token with the following permissions:
   - **Zone:** `Zone:Edit`, `Zone Settings:Edit`, `DNS:Edit`
   - **Account:** `Workers Routes:Edit`, `Workers Custom Domains:Edit`
3. Your Cloudflare Account ID (found on the right side of the Cloudflare Dashboard overview page).

## Quickstart

1. Navigate to the `infra/` directory:

   ```sh
   cd infra
   ```

2. Copy the example variables file:

   ```sh
   cp terraform.tfvars.example terraform.tfvars
   ```

3. Fill in your `cloudflare_api_token` and `cloudflare_account_id` in `terraform.tfvars`.

4. Initialize and apply the configuration:

   ```sh
   terraform init
   terraform plan
   terraform apply
   ```

5. The output will display the two assigned Cloudflare nameservers:

   ```sh
   nameservers = [
     "adam.ns.cloudflare.com",
     "betty.ns.cloudflare.com",
   ]
   ```

6. In your Spaceship.com Launchpad:
   - Go to **Domains** &rarr; **`joli.to`** &rarr; **Nameservers**.
   - Switch to **Custom DNS** and enter the two nameservers.
