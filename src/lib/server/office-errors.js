const OFFICE_ERROR_MESSAGES = {
  call_outcome_failed: "The call outcome could not be saved. Please try again.",
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
  settings_save_failed: "The settings could not be saved. Please try again.",
};

export function officeErrorMessage(code) {
  return OFFICE_ERROR_MESSAGES[String(code || "")] || "The action could not be completed. Please try again.";
}
