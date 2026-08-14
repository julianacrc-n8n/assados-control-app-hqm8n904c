/// <reference path="../pb_data/types.d.ts" />
// Adds an optional `orderNotes` text field to the `sales` collection.
// Stores optional order annotations entered by the user in the PDV checkout
// (ex: "sem cebola", "bem passado", "cliente vai buscar as 18h"). null for
// iFood imported sales (iFood orders have their own notes in the portal).
// No existing field is modified and no other collection is touched.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('sales')

    if (!col.fields.getByName('orderNotes')) {
      col.fields.add(
        new TextField({
          name: 'orderNotes',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sales')
    const field = col.fields.getByName('orderNotes')
    if (field) col.fields.remove(field)
    app.save(col)
  },
)
