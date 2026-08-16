// Every code here is a literal or fallback value that src/app/office/actions.js
// (and the modules under src/lib/server/office/) can redirect with as ?error=.
// Kept in one place, grouped by the page/domain that produces it, so a code
// added to a redirect always has somewhere obvious to add its message too.
const OFFICE_ERROR_MESSAGES = {
  // Generic / shared across several forms
  missing: "A required field is missing.",
  incomplete: "Please complete all required fields.",
  update_incomplete: "Please complete all required fields before updating.",
  invalid_action: "That action isn't recognized.",
  update_failed: "The update could not be saved. Please try again.",
  create_failed: "The record could not be created. Please try again.",
  prepare_failed: "This could not be prepared. Please try again.",
  resolve_failed: "This could not be resolved. Please try again.",
  refresh_failed: "The refresh failed. Please try again.",
  review_failed: "The review could not be saved. Please try again.",
  start_failed: "This could not be started. Please try again.",
  transition_invalid: "That transition isn't valid from the current status.",

  // B2B certification / launch activation
  attestation_failed: "The attestation could not be recorded.",
  checks_failed: "One or more certification checks failed. Review the checkpoints below.",
  conversion_failed: "The synthetic paid-conversion step failed.",
  crm_sync_pending: "CRM synchronization for the synthetic leads hasn't completed yet — try again shortly.",
  deposit_failed: "The synthetic deposit record could not be created.",
  run_missing: "That certification run could not be found.",
  signoff_blocked: "Sign-off is blocked until all required checkpoints pass.",

  // Holiday SLA / production incidents / deliverability
  escalation_failed: "The SLA escalation refresh failed.",
  escalation_missing: "That escalation is no longer open or doesn't exist.",
  incident_missing: "That incident could not be found.",
  resume_checklist_required: "Confirm every item on the checklist before resuming outbound sending.",
  resume_failed: "Outbound sending could not be resumed. Please try again.",
  threshold_still_exceeded: "Deliverability is still over the safe threshold — sending stays paused.",

  // Outreach drafts / sales response
  invalid_draft: "Choose a lead and a valid response type.",
  lead_missing: "That lead could not be found or has no email on file.",
  draft_failed: "The response draft could not be created.",
  response_incomplete: "A subject and email body are required.",
  response_unavailable: "This response is no longer available to send.",
  response_claim_failed: "This response is already being sent.",
  email_not_configured: "Email sending is not configured.",
  send_failed: "The email could not be sent. Review its status before retrying.",

  // Organic intent radar
  queries_required: "At least one search query is required.",
  source_config_failed: "The source configuration could not be saved.",

  // Growth brief / experiments
  experiment_missing: "That experiment could not be found.",
  experiment_prepare_failed: "New experiment proposals could not be prepared.",
  experiment_update_failed: "The experiment could not be updated.",

  // Campaign ROI
  invalid_spend: "Enter a valid date, source, and amount.",
  spend_save_failed: "The ad spend entry could not be saved.",

  // Lead scoring
  invalid_override: "Enter a valid score (0-100) and a reason, or clear the override.",
  override_failed: "The score override could not be saved.",

  // Warm relationship signals
  invalid_settings: "Enter a valid reactivation window (14-730 days).",
  invalid_signal: "Choose a valid signal type and provide at least a few words of evidence.",
  invalid_review: "Choose a valid review status.",
  settings_failed: "The warm-signal settings could not be saved.",
  signal_failed: "The signal could not be recorded.",

  // Content distribution
  published_url_required: "Enter the published URL before marking this as published.",
  posted_url_required: "Enter the URL where this was posted.",
  schedule_required: "Choose a date and time to schedule this for.",

  // System settings
  settings_save_failed: "The settings could not be saved. Please try again.",

  // Call outcomes / proposals / event capacity (deal workflow)
  call_outcome_failed: "The call outcome could not be saved. Please try again.",
  capacity_check_failed: "Availability could not be checked for that date and time.",
  capacity_hold_required: "Place a capacity hold for this date before sending a proposal.",
  hold_create_failed: "The capacity hold could not be created.",
  hold_release_failed: "The capacity hold could not be released.",
  host_update_failed: "The host settings could not be saved.",
  invalid_hold: "Enter a valid date, time, time zone, and duration for the hold.",
  invalid_host_settings: "Enter a valid concurrent-event limit and time zone.",
  lead_creation_failed: "Synthetic lead creation failed.",
  lead_not_linked: "This lead isn't linked to a CRM prospect yet.",
  proposal_already_being_sent: "This proposal is already being processed.",
  proposal_claim_failed: "The proposal could not be prepared for sending.",
  proposal_content_required: "A proposal subject and email body are required.",
  proposal_create_failed: "The proposal could not be created.",
  proposal_email_not_configured: "Proposal email is not configured.",
  proposal_incomplete: "Complete the package, price, and expiration date.",
  proposal_missing_recipient: "The associated deal does not have a recipient email.",
  proposal_not_available: "This proposal is no longer available to send.",
  proposal_not_reconcilable: "This proposal does not have a provider-accepted send to reconcile.",
  proposal_payment_request_failed: "The proposal payment request could not be created.",
  proposal_reconcile_failed: "The recorded send could not be reconciled. An urgent task remains open.",
  proposal_send_blocked: "Proposal sending is currently blocked by an email safety setting or daily limit.",
  proposal_send_failed: "The proposal email could not be sent. Review its status before retrying.",
};

export function officeErrorMessage(code) {
  return OFFICE_ERROR_MESSAGES[String(code || "")] || "The action could not be completed. Please try again.";
}
