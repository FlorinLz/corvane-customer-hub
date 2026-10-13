// Brief 7.1.13. VAT values are fictional and only pass the M14 AC2 format
// check (except Revolut's LEI, which is deliberately invalid: transposed
// check digits).
export interface SeedBillingProfile {
  entity: string;
  billingLegalName: string;
  street: string;
  city: string;
  postalCode: string | null;
  country: string;
  vatId: string | null;
  lei: string;
  contractingEntity: string;
}

export const BILLING_PROFILES: SeedBillingProfile[] = [
  { entity: "hvb", billingLegalName: "UniCredit Bank GmbH", street: "Arabellastraße 12", city: "München", postalCode: null, country: "DE", vatId: null, lei: "2ZCNRR8UK83OBTEK2170", contractingEntity: "Corvane Europe B.V." },
  { entity: "revolut", billingLegalName: "Revolut Ltd", street: "30 South Colonnade", city: "London", postalCode: "E14 5HX", country: "GB", vatId: "GB987654321", lei: "213800MQORWPL582SW28", contractingEntity: "Corvane Singapore Pte. Ltd." },
  { entity: "totta", billingLegalName: "Banco Santander Totta, S.A.", street: "Rua do Ouro 88", city: "Lisboa", postalCode: "1100-063", country: "PT", vatId: "PT500000017", lei: "549300URJH9VSI58CS32", contractingEntity: "Corvane Europe B.V." },
  { entity: "scbIt", billingLegalName: "Santander Consumer Bank S.p.A.", street: "Corso Massimo d'Azeglio 33/E", city: "Torino", postalCode: "10126", country: "IT", vatId: "IT01234567890", lei: "549300O0YQXDOJB36Y73", contractingEntity: "Corvane Europe B.V." },
  { entity: "lloyds", billingLegalName: "Lloyds Bank plc", street: "25 Gresham Street", city: "London", postalCode: "EC2V 7HN", country: "GB", vatId: "GB123456789", lei: "H7FNTJ4851HG0EXQ1Z70", contractingEntity: "Corvane Singapore Pte. Ltd." },
  { entity: "mps", billingLegalName: "Banca Monte dei Paschi di Siena S.p.A.", street: "Piazza Salimbeni 3", city: "Siena", postalCode: "53100", country: "IT", vatId: "IT09876543210", lei: "J4CP7MHCXR8DAQMKIL78", contractingEntity: "Corvane Europe B.V." },
  { entity: "adyen", billingLegalName: "Adyen N.V.", street: "Simon Carmiggeltstraat 6-50", city: "Amsterdam", postalCode: "1011 DJ", country: "NL", vatId: "NL123456789B01", lei: "724500973ODKK3IFQ447", contractingEntity: "Corvane Europe B.V." },
  { entity: "monzo", billingLegalName: "Monzo Bank Ltd", street: "Broadwalk House, 5 Appold Street", city: "London", postalCode: "EC2A 2AG", country: "GB", vatId: "GB555666777", lei: "213800PLUYXGZ8LU7T61", contractingEntity: "Corvane Singapore Pte. Ltd." },
  { entity: "nordea", billingLegalName: "Nordea Bank Abp", street: "Demo address 1", city: "Helsinki", postalCode: "00020", country: "FI", vatId: "FI123456789", lei: "529900ODI3047E2LIV03", contractingEntity: "Corvane Europe B.V." },
  { entity: "ingdiba", billingLegalName: "ING-DiBa AG", street: "Demo address 1", city: "Frankfurt", postalCode: "60325", country: "DE", vatId: "DE123456789", lei: "3KXUNHVVQFIJN6RHLO76", contractingEntity: "Corvane Europe B.V." },
  { entity: "ceska", billingLegalName: "Česká spořitelna, a.s.", street: "Demo address 1", city: "Praha", postalCode: "14000", country: "CZ", vatId: "CZ123456789", lei: "9KOGW2C2FCIOJQ7FF485", contractingEntity: "Corvane Europe B.V." },
  { entity: "rbi", billingLegalName: "Raiffeisen Bank International AG", street: "Demo address 1", city: "Wien", postalCode: "1030", country: "AT", vatId: "AT123456789", lei: "9ZHRYM6F437SQJ6OUG95", contractingEntity: "Corvane Europe B.V." },
];

/**
 * No profile:
 * - zopa: 9 fields missing (no contract either)
 * - santanderUk, scbPt: "Billed through Banco Santander Totta, S.A." (M14 AC15), no flag
 * - ocbc, boi: "Billing profile not required: partner role only", no flag
 */
export const BILLING_BILLED_THROUGH: Record<string, string> = {
  santanderUk: "Banco Santander Totta, S.A.",
  scbPt: "Banco Santander Totta, S.A.",
};
