/// <reference path="../pb_data/types.d.ts" />
// Adds four optional fields to the `sales` collection to support the iFood
// importer: ifoodCommission (number), ifoodOrderId (text), salesChannel
// (select: PDV | iFood) and isStockAdjustment (bool). No existing field is
// modified and no other collection is touched.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('sales')

    if (!col.fields.getByName('ifoodCommission')) {
      col.fields.add(
        new NumberField({
          name: 'ifoodCommission',
          required: false,
          min: 0,
          onlyInt: false,
        }),
      )
    }

    if (!col.fields.getByName('ifoodOrderId')) {
      col.fields.add(
        new TextField({
          name: 'ifoodOrderId',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('salesChannel')) {
      col.fields.add(
        new SelectField({
          name: 'salesChannel',
          required: false,
          values: ['PDV', 'iFood'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('isStockAdjustment')) {
      col.fields.add(
        new BoolField({
          name: 'isStockAdjustment',
          required: false,
        }),
      )
    }

    app.save(col)

    // Backfill existing rows with sane defaults so filters work immediately.
    app
      .db()
      .newQuery(`UPDATE sales SET ifoodCommission = 0 WHERE ifoodCommission IS NULL`)
      .execute()
    app
      .db()
      .newQuery(
        `UPDATE sales SET salesChannel = 'PDV' WHERE salesChannel IS NULL OR salesChannel = ''`,
      )
      .execute()
    app
      .db()
      .newQuery(`UPDATE sales SET isStockAdjustment = 0 WHERE isStockAdjustment IS NULL`)
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sales')
    for (const name of ['ifoodCommission', 'ifoodOrderId', 'salesChannel', 'isStockAdjustment']) {
      const field = col.fields.getByName(name)
      if (field) col.fields.remove(field)
    }
    app.save(col)
  },
)
