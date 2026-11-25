/** The columns an Excel sheet can have: key, heading, width. Shared by the server and the column chooser. */
export const EXPORT_COLUMNS: [string, string, number][] = [
  ["full_name", "Name", 26], ["current_title", "Title", 30], ["current_company", "Company", 26], ["city", "City", 16],
  ["total_experience_years", "Experience (years)", 13], ["highest_education", "Education", 28], ["skills", "Skills", 44],
  ["linkedin_url", "LinkedIn", 34], ["phone", "Phone", 18], ["email", "Email", 30], ["current_salary", "Current salary", 20],
  ["expected_salary", "Expected salary", 20], ["notice_period", "Notice period", 16], ["candidate_status", "Status", 14],
  ["stage", "Stage", 16], ["roles_stages", "Roles and stages", 40], ["latest_note", "Latest note", 44], ["drive_link", "Resume link", 36],
];
/** The standard sheet. */
export const DEFAULT_EXPORT = ["full_name", "current_company", "city", "total_experience_years", "highest_education", "phone", "email", "linkedin_url", "drive_link"];
