const config = {
  // URL principal da aplicação - usa variável de ambiente BASE_URL
  BASE_URL: process.env.BASE_URL || 
           (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : 
           'https://purring-carma-cmbmnews-711b5e33.koyeb.app'),
}

module.exports = config;