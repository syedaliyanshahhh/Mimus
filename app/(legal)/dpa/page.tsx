import type { Metadata } from 'next';
import { LegalMarkdown, readLegalDoc } from '../legal-markdown';

export const metadata: Metadata = { title: 'Data Processing Agreement · Mimus' };

const source = readLegalDoc('dpa.md');

export default function DpaPage() {
  return <LegalMarkdown source={source} />;
}
