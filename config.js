const config = {
  // URL principal da aplicação - detecta automaticamente o domínio do Koyeb
  BASE_URL: process.env.KOYEB_PUBLIC_DOMAIN 
    ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` 
    : 'https://purring-carma-cmbmnews-711b5e33.koyeb.app',
}