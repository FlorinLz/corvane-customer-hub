/**
 * The contact the Person field starts on in Record notification and Confirm resolution: the issue's Incident contact. `contacts` arrives
 * primary-first (the issue page's query), so the first INCIDENT is the primary one when there is one, as in the page's own incident-contact
 * block. "" when there is none: the user picks. Still changeable.
 */
export function defaultIncidentContactId(contacts: { id: string; role: string }[]): string {
  return contacts.find((c) => c.role === "INCIDENT")?.id ?? "";
}
