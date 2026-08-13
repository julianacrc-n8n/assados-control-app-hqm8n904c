/// <reference path="../pb_data/types.d.ts" />
// Adds an optional `deliveryFee` number field (default 0) to the `sales`
// collection. No other field or collection is touched.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('sales')

    if (!col.fields.getByName('deliveryFee')) {
      col.fields.add(
        new NumberField({
          name: 'deliveryFee',
          required: false,
          min: 0,
          onlyInt: false,
        }),
      )
      app.save(col)
    }

    // Backfill existing rows so they default to 0 (SQLite NULLs otherwise).
    app.db().newQuery(`UPDATE sales SET deliveryFee = 0 WHERE deliveryFee IS NULL`).execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sales')
    const field = col.fields.getByName('deliveryFee')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
