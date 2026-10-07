import ts from 'typescript';

/** Replace only exported metadata nodes; preserve the page and its fallback metadata. */
export function installPublishedMetadata(source, type, slug = null) {
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fallback = '{}';
  const edits = [];
  for (const statement of ast.statements) {
    if (!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === 'generateMetadata') {
      fallback = 'await v34PreviousMetadata(props, parent)';
      edits.push({start:statement.getStart(ast),end:statement.end,text:statement.getText(ast).replace(/^export\s+/, '').replace(/\bgenerateMetadata\b/, 'v34PreviousMetadata')});
    } else if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(node=>ts.isIdentifier(node.name)&&node.name.text==='metadata')) {
      if(statement.declarationList.declarations.length!==1)throw new Error('Unrecognized combined metadata declaration');
      fallback = 'v34PreviousMetadata';
      edits.push({start:statement.getStart(ast),end:statement.end,text:statement.getText(ast).replace(/^export\s+/, '').replace(/\bmetadata\b/, 'v34PreviousMetadata')});
    }
  }
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  const selectedSlug = slug === null ? 'decodeURIComponent((await props.params).slug)' : JSON.stringify(slug);
  return `import { getStaticEntryMetadata as getV34Metadata } from "@/lib/cms";\n${source}\nexport async function generateMetadata(props: any, parent: any) { return (await getV34Metadata(${JSON.stringify(type)}, ${selectedSlug})) ?? (${fallback}); }\n`;
}
