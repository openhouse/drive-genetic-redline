export function acceptAllTrackedChanges(documentXml: string): string {
  return documentXml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '').replace(/<\/?w:ins\b[^>]*>/g, '').replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, '').match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)?.map(x => x.replace(/^<w:t\b[^>]*>|<\/w:t>$/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')).join('') ?? '';
}
