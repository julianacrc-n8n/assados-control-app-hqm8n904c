/// <reference path="../pb_data/types.d.ts" />
// Adds an optional `pickupCode` text field to the `sales` collection.
// Stores a 4-digit pickup password (e.g. "0473") generated automatically when
// a PDV sale is completed. null for iFood imported sales. No existing field is
// modified and no other collection is touched.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('sales')

    if (!col.fields.getByName('pickupCode')) {
      col.fields.add(
        new TextField({
          name: 'pickupCode',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sales')
    const field = col.fields.getByName('pickupCode')
    if (field) col.fields.remove(field)
    app.save(col)
  },
)
