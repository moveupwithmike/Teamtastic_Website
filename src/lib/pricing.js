export const HOSTED_PRICING = {
  corePerPerson: 35,
  premiumPerPerson: 58,
  minimum: 350,
  minimumGroupSize: 10,
  deposit: 200,
};

export function hostedStartingPriceCopy() {
  return `Live-hosted Teamtastic events start at $${HOSTED_PRICING.corePerPerson} per person, with a $${HOSTED_PRICING.minimum} minimum for groups up to ${HOSTED_PRICING.minimumGroupSize}.`;
}

