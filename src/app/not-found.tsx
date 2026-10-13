import { Search } from "lucide-react";

import { AccessMessage } from "@/components/shell/AccessMessage";

// Brief 5.2, resolution 61. Also catches any unmatched route for the app.
export default function NotFound() {
  return (
    <AccessMessage
      icon={Search}
      message="We couldn't find that page. Search for a customer or go to Home."
      actions={[
        { label: "Go to search", href: "/search", variant: "secondary" },
        { label: "Go to Home", href: "/", variant: "text" },
      ]}
    />
  );
}
