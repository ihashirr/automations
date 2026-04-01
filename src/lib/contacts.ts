import * as Contacts from "expo-contacts";

type SaveContactInput = {
  contactPerson: string;
  phone: string;
  shopName: string;
};

export async function saveLeadToContacts({
  contactPerson,
  phone,
  shopName,
}: SaveContactInput) {
  if (!phone.trim()) {
    throw new Error("Add a phone number before saving to contacts.");
  }

  const available = await Contacts.isAvailableAsync();

  if (!available) {
    throw new Error("Contacts are not available on this device.");
  }

  const permission = await Contacts.requestPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Contacts permission was denied.");
  }

  const firstName = contactPerson.trim() || shopName.trim();
  const contact: Contacts.Contact = {
    contactType: Contacts.ContactTypes.Person,
    name: shopName.trim(),
    firstName,
    company: shopName.trim(),
    phoneNumbers: [
      {
        label: "mobile",
        number: phone.trim(),
      },
    ],
  };

  return await Contacts.addContactAsync(contact);
}
