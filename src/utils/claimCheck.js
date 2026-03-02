// ClaimCheck utility for hustle validation
export const claimCheck = {
  validateHustle: (hustle) => {
    if (!hustle || typeof hustle !== 'object') return false
    return !!(hustle.id && hustle.name && hustle.source && hustle.alphaScore >= 0)
  },
  
  isHighAlpha: (alphaScore) => alphaScore >= 80,
  
  getAlphaLevel: (alphaScore) => {
    if (alphaScore >= 90) return 'CRITICAL'
    if (alphaScore >= 70) return 'HIGH'
    if (alphaScore >= 40) return 'MEDIUM'
    return 'LOW'
  },
  
  shouldNotify: (hustle) => {
    return hustle.alphaScore >= 85 && hustle.timestamp > Date.now() - (1000 * 60 * 60 * 3)
  }
}