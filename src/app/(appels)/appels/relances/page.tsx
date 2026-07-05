import { getRelances } from "../actions";
import { RelancesClient } from "./RelancesClient";

export default async function RelancesPage() {
  const relances = await getRelances();
  return <RelancesClient relances={relances} />;
}
