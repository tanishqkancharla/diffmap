# Table

Gallery: `/components/table`. Import from `"maui"`.

React Aria table. Columns live **directly** in `TableHeader` (no header `TableRow`).

```tsx
<Table aria-label="Invoices">
  <TableHeader>
    <TableHead isRowHeader>Invoice</TableHead>
    <TableHead>Status</TableHead>
    <TableHead align="end">Amount</TableHead>
  </TableHeader>
  <TableBody>
    {rows.map((row) => (
      <TableRow key={row.id} id={row.id}>
        <TableCell>{row.id}</TableCell>
        <TableCell>{row.status}</TableCell>
        <TableCell align="end">{row.amount}</TableCell>
      </TableRow>
    ))}
  </TableBody>
  <TableFooter>
    <TableRow id="total">
      <TableCell colSpan={2}>Total</TableCell>
      <TableCell align="end">$2,500.00</TableCell>
    </TableRow>
  </TableFooter>
</Table>
<TableCaption>Recent invoices.</TableCaption>
```

Rules:

- Mark the identifying column with `isRowHeader` (name/id, not a checkbox).
- `align` on `TableHead` / `TableCell`: `"start"` | `"center"` | `"end"`.
- `TableHead` and `TableCell` use tabular numerals (`text({ tabular: true })`).
- Selection is **opt-in**. Without `selectionMode`, rows do not highlight on hover.
- `selectionMode="multiple"` inserts a leading checkbox column (select-all in the header). Hover/selected washes follow `data-selection-mode`.
- `TableBody` default empty state is “No results.” Pass `renderEmptyState`.
- Put `TableCaption` **after** `Table` (often inside a `<figure>`).
- `TableFooter` uses `gray[2]`.
