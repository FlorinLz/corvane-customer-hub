import { notFound } from "next/navigation";
import { Clock, Copy, Mail, Phone } from "lucide-react";
import { ContactContext, ContactRole, type Team } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { ContactDrawer } from "@/components/entity/contacts/ContactDrawer";
import { MarkAsVerifiedButton } from "@/components/entity/contacts/MarkAsVerifiedButton";
import { computeAvailability } from "@/server/derived/availability";
import { contactOwnerTeams } from "@/server/derived/contact-ownership";
import { daysBetween, formatDate, now, toLocalDate, today } from "@/lib/dates";
import { CONTACT_ROLE_LABELS, CONTACT_ROLE_ORDER, ownedByLabel } from "@/lib/labels";
import { loadContactsData, type ContactsData } from "@/server/queries/contacts";
import { getCurrentUser } from "@/server/session";

type Contact = ContactsData["contacts"][number];

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatAvailabilityWindow(days: number[], start: string, end: string): string {
  const sorted = [...days].sort((a, b) => a - b);
  const isContiguous = sorted.length > 1 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  const dayPart =
    sorted.length === 7
      ? "Every day"
      : isContiguous
        ? `${WEEKDAY_SHORT[sorted[0] - 1]} to ${WEEKDAY_SHORT[sorted[sorted.length - 1] - 1]}`
        : sorted.map((d) => WEEKDAY_SHORT[d - 1]).join(", ");
  return `${dayPart}, ${start} to ${end}`;
}

function verificationThresholdDays(context: ContactContext, role: ContactRole): number | null {
  if (role === "BILLING") return 182;
  if (context === "PARTNER") return 90;
  return null;
}

function ContactRow({ contact, entityId, canEdit, offeredRoles }: { contact: Contact; entityId: string; canEdit: boolean; offeredRoles: ContactRole[] }) {
  const availability =
    contact.timeZone != null
      ? computeAvailability({
          timeZone: contact.timeZone,
          available24x7: contact.available24x7,
          availabilityDays: contact.availabilityDays,
          availabilityStart: contact.availabilityStart,
          availabilityEnd: contact.availabilityEnd,
          now: now(),
        })
      : null;

  const verifiedDaysAgo = contact.lastVerifiedAt ? daysBetween(toLocalDate(contact.lastVerifiedAt), today()) : null;
  const threshold = verificationThresholdDays(contact.context, contact.role);
  const verificationOverdue = threshold !== null && verifiedDaysAgo !== null && verifiedDaysAgo > threshold;

  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{contact.fullName}</span>
        {contact.jobTitle && <span className="text-meta text-text-secondary">{contact.jobTitle}</span>}
        {contact.isPrimary && contact.role === "INCIDENT" && <Badge variant="brand">Primary</Badge>}
        <Badge variant={contact.status === "ACTIVE" ? "success" : "muted"}>{contact.status === "ACTIVE" ? "Active" : "Left"}</Badge>
        <span className="flex-1" />
        {canEdit && (
          <div className="flex items-center gap-3">
            {contact.status === "ACTIVE" && <MarkAsVerifiedButton contactId={contact.id} version={contact.version} />}
            <ContactDrawer
              entityId={entityId}
              contactId={contact.id}
              version={contact.version}
              offeredRoles={offeredRoles}
              contexts={[contact.context]}
              initial={{
                context: contact.context,
                role: contact.role,
                fullName: contact.fullName,
                email: contact.email,
                phone: contact.phone ?? "",
                timeZone: contact.timeZone ?? "",
                available24x7: contact.available24x7,
                fromDay: contact.availabilityDays[0] ?? 1,
                toDay: contact.availabilityDays[contact.availabilityDays.length - 1] ?? 5,
                start: contact.availabilityStart ?? "09:00",
                end: contact.availabilityEnd ?? "18:00",
                jobTitle: contact.jobTitle ?? "",
                status: contact.status,
              }}
              trigger={
                <Button variant="text" size="md" className="h-auto p-0 text-meta">
                  Edit
                </Button>
              }
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta">
        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-link-text hover:underline">
          <Mail className="size-3.5" aria-hidden="true" /> {contact.email}
        </a>
        {contact.phone && (
          <span className="flex items-center gap-1">
            <Phone className="size-3.5 text-text-secondary" aria-hidden="true" />
            <a href={`tel:${contact.phone}`} className="font-mono text-link-text hover:underline">
              {contact.phone}
            </a>
            <IconButton aria-label="Copy phone number">
              <Copy className="size-3.5" aria-hidden="true" />
            </IconButton>
          </span>
        )}
        {contact.timeZone && availability && (
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 text-text-secondary" aria-hidden="true" />
            {contact.timeZone} · Local time {availability.localTime}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-meta">
        {contact.available24x7 ? (
          <span className="text-text-secondary">24/7</span>
        ) : contact.availabilityDays.length > 0 && contact.availabilityStart && contact.availabilityEnd ? (
          <span className="text-text-secondary">{formatAvailabilityWindow(contact.availabilityDays, contact.availabilityStart, contact.availabilityEnd)}</span>
        ) : null}
        {availability?.hasWindow && (
          <Badge variant={availability.isAvailableNow ? "success" : "due"}>{availability.isAvailableNow ? "Available now" : "Outside availability"}</Badge>
        )}
      </div>
      {contact.status === "ACTIVE" ? (
        <span className={`text-meta ${verificationOverdue ? "text-due" : "text-text-secondary"}`}>
          {verifiedDaysAgo !== null
            ? `Verified ${verifiedDaysAgo === 0 ? "today" : `${verifiedDaysAgo} day${verifiedDaysAgo === 1 ? "" : "s"} ago`}${contact.lastVerifiedBy ? ` by ${contact.lastVerifiedBy.name}` : ""}`
            : "Not verified"}
        </span>
      ) : (
        <span className="text-meta text-text-secondary">
          Left on {contact.leftOn ? formatDate(toLocalDate(contact.leftOn)) : "unknown date"}
          {contact.leftNote && ` · ${contact.leftNote}`}
        </span>
      )}
    </div>
  );
}

function RoleGroup({ context, role, contacts, entityId, userTeam }: { context: ContactContext; role: ContactRole; contacts: Contact[]; entityId: string; userTeam: Team }) {
  const owners = contactOwnerTeams(context, role);
  const canEdit = owners.includes(userTeam);
  return (
    <div className="border-t border-border py-3 first:border-t-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-meta font-medium text-text-secondary">
          {context === "CUSTOMER" ? "Customer" : "Partner"} · {CONTACT_ROLE_LABELS[role]} · {contacts.length}
        </span>
        <span className="flex-1" />
        <OwnedBy label={ownedByLabel(owners)} />
      </div>
      {contacts.length === 0 ? (
        <p className="text-meta text-text-secondary">No contacts for this role yet.</p>
      ) : (
        <div>
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} entityId={entityId} canEdit={canEdit} offeredRoles={[role]} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextSection({ context, contacts, entityId, userTeam }: { context: ContactContext; contacts: Contact[]; entityId: string; userTeam: Team }) {
  return (
    <Card>
      <h3 className="mb-1 text-subsection">{context === "CUSTOMER" ? "Customer contacts" : "Partner contacts"}</h3>
      {CONTACT_ROLE_ORDER.map((role) => (
        <RoleGroup
          key={role}
          context={context}
          role={role}
          contacts={contacts.filter((c) => c.role === role && c.status === "ACTIVE")}
          entityId={entityId}
          userTeam={userTeam}
        />
      ))}
    </Card>
  );
}

export default async function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadContactsData(id), getCurrentUser()]);
  if (!data) notFound();

  const hasCustomer = data.entity.customerRole?.active ?? false;
  const hasPartner = data.entity.partnerRole?.active ?? false;
  const former = data.contacts.filter((c) => c.status === "LEFT");

  const contexts: ContactContext[] = hasPartner ? (["PARTNER", ...(hasCustomer ? (["CUSTOMER"] as const) : [])] as ContactContext[]) : ["CUSTOMER"];
  const addableContexts = contexts.filter((ctx) => Object.values(ContactRole).some((r) => contactOwnerTeams(ctx, r).includes(user.team)));
  const addableRoles = CONTACT_ROLE_ORDER.filter((r) => addableContexts.some((ctx) => contactOwnerTeams(ctx, r).includes(user.team)));

  if (data.contacts.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-meta text-text-secondary">No contacts yet.</p>
        {addableContexts.length > 0 && (
          <ContactDrawer
            entityId={id}
            offeredRoles={addableRoles}
            contexts={addableContexts}
            trigger={<Button className="self-start">Add contact</Button>}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {addableContexts.length > 0 && (
          <ContactDrawer entityId={id} offeredRoles={addableRoles} contexts={addableContexts} trigger={<Button>Add contact</Button>} />
        )}
      </div>

      {contexts.map((ctx) => (
        <ContextSection key={ctx} context={ctx} contacts={data.contacts.filter((c) => c.context === ctx)} entityId={id} userTeam={user.team} />
      ))}

      {former.length > 0 && (
        <details>
          <summary className="cursor-pointer text-meta text-text-secondary">Former contacts ({former.length})</summary>
          <Card className="mt-2">
            {former.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                entityId={id}
                canEdit={contactOwnerTeams(c.context, c.role).includes(user.team)}
                offeredRoles={[c.role]}
              />
            ))}
          </Card>
        </details>
      )}
    </div>
  );
}
