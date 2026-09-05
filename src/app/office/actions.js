"use server";
import * as authentication from "@/lib/server/office/authentication";
import * as certification from "@/lib/server/office/certification";
import * as launch from "@/lib/server/office/launch";
import * as sla from "@/lib/server/office/sla";
import * as deliverability from "@/lib/server/office/deliverability";
import * as incidents from "@/lib/server/office/incidents";
import * as intelligence from "@/lib/server/office/intelligence";
import * as outreach from "@/lib/server/office/outreach";
import * as organic from "@/lib/server/office/organic";
import * as growth from "@/lib/server/office/growth-actions";
import * as salesResponse from "@/lib/server/office/sales-response-actions";
import * as signals from "@/lib/server/office/relationship-signals";
import * as distribution from "@/lib/server/office/distribution";
import * as configuration from "@/lib/server/office/configuration";
import * as proposals from "@/lib/server/office/proposals";
import * as capacity from "@/lib/server/office/capacity";

export async function requestMagicLink(v) { return authentication.requestMagicLink(v); }
export async function signOutOffice() { return authentication.signOutOffice(); }
export async function startB2bCertification() { return certification.startB2bCertification(); }
export async function verifyB2bCertification(v) { return certification.verifyB2bCertification(v); }
export async function refreshFinalCertification(v) { return certification.refreshFinalCertification(v); }
export async function signOffFinalCertification(v) { return certification.signOffFinalCertification(v); }
export async function recordFinalCertificationAttestation(v) { return certification.recordFinalCertificationAttestation(v); }
export async function transitionB2bLaunch(v) { return launch.transitionB2bLaunch(v); }
export async function refreshHolidaySlaEscalations() { return sla.refreshHolidaySlaEscalations(); }
export async function resolveHolidayEscalation(v) { return sla.resolveHolidayEscalation(v); }
export async function resumeOutboundAfterDeliverabilityReview(v) { return deliverability.resumeOutboundAfterDeliverabilityReview(v); }
export async function refreshProductionIncidents() { return incidents.refreshProductionIncidents(); }
export async function updateProductionIncident(v) { return incidents.updateProductionIncident(v); }
export async function refreshAudienceIntelligence() { return intelligence.refreshAudienceIntelligence(); }
export async function refreshDailyGrowthAgenda() { return intelligence.refreshDailyGrowthAgenda(); }
export async function reviewOutreachDraft(v) { return outreach.reviewOutreachDraft(v); }
export async function createOrganicOpportunity(v) { return organic.createOrganicOpportunity(v); }
export async function reviewOrganicOpportunity(v) { return organic.reviewOrganicOpportunity(v); }
export async function updateOrganicSourceConfig(v) { return organic.updateOrganicSourceConfig(v); }
export async function refreshGrowthBrief() { return growth.refreshGrowthBrief(); }
export async function saveCampaignAdSpend(v) { return growth.saveCampaignAdSpend(v); }
export async function overrideLeadScore(v) { return growth.overrideLeadScore(v); }
export async function refreshLeadScores() { return growth.refreshLeadScores(); }
export async function reviewGrowthBrief(v) { return growth.reviewGrowthBrief(v); }
export async function prepareGrowthExperiments() { return growth.prepareGrowthExperiments(); }
export async function updateGrowthExperiment(v) { return growth.updateGrowthExperiment(v); }
export async function refreshMarketingRecommendations() { return growth.refreshMarketingRecommendations(); }
export async function reviewMarketingRecommendation(v) { return growth.reviewMarketingRecommendation(v); }
export async function createSalesResponseDraft(v) { return salesResponse.createSalesResponseDraft(v); }
export async function approveAndSendSalesResponse(v) { return salesResponse.approveAndSendSalesResponse(v); }
export async function configureWarmRelationshipSignals(v) { return signals.configureWarmRelationshipSignals(v); }
export async function recordWarmRelationshipSignal(v) { return signals.recordWarmRelationshipSignal(v); }
export async function reviewWarmRelationshipSignal(v) { return signals.reviewWarmRelationshipSignal(v); }
export async function prepareDistributionQueue() { return distribution.prepareDistributionQueue(); }
export async function reviewDistributionItem(v) { return distribution.reviewDistributionItem(v); }
export async function updateSystemConfig(v) { return configuration.updateSystemConfig(v); }
export async function recordCallOutcome(v) { return proposals.recordCallOutcome(v); }
export async function createProposal(v) { return proposals.createProposal(v); }
export async function approveAndSendProposal(v) { return proposals.approveAndSendProposal(v); }
export async function reconcileProposalSend(v) { return proposals.reconcileProposalSend(v); }
export async function createEventCapacityHold(v) { return capacity.createEventCapacityHold(v); }
export async function releaseEventCapacityHold(v) { return capacity.releaseEventCapacityHold(v); }
export async function updateEventCapacityHost(v) { return capacity.updateEventCapacityHost(v); }
