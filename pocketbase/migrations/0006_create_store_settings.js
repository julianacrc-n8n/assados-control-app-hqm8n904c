/// <reference path="../pb_data/types.d.ts" />
// Creates the `store_settings` collection — a single-record base collection
// that holds the white-label / store configuration for the authenticated
// user (store name, logo, contact info, thank-you message, primary color,
// and developer branding shown on printed receipts).
//
// Access rules:
//   list / view / create / update — authenticated only
//   delete — locked (superusers only)
//
// No existing collection is modified.

migrate(
  (app) => {
    // Guard: skip if the collection already exists (idempotent).
    let col
    try {
      col = app.findCollectionByNameOrId('store_settings')
    } catch (_) {
      col = new Collection({
        name: 'store_settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: null,
        fields: [
          // Store identity
          { name: 'storeName', type: 'text', required: true },
          { name: 'storeLogoUrl', type: 'text', required: false },
          { name: 'storePhone', type: 'text', required: false },
          { name: 'storeWhatsapp', type: 'text', required: false },
          { name: 'storeInstagram', type: 'text', required: false },
          { name: 'storeAddress', type: 'text', required: false },
          { name: 'storeThankYouMessage', type: 'text', required: false },
          { name: 'storePrimaryColor', type: 'text', required: false },

          // Developer branding
          { name: 'devBrandName', type: 'text', required: false },
          { name: 'devBrandWhatsapp', type: 'text', required: false },
          { name: 'devBrandShowOnReceipt', type: 'bool', required: false },
          { name: 'devBrandLandingPageUrl', type: 'text', required: false },

          // System fields (required for base collections)
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
    }

    // Ensure all fields exist (safe to re-run / extend).
    if (!col.fields.getByName('storeName')) {
      col.fields.add(new TextField({ name: 'storeName', required: true }))
    }
    if (!col.fields.getByName('storeLogoUrl')) {
      col.fields.add(new TextField({ name: 'storeLogoUrl', required: false }))
    }
    if (!col.fields.getByName('storePhone')) {
      col.fields.add(new TextField({ name: 'storePhone', required: false }))
    }
    if (!col.fields.getByName('storeWhatsapp')) {
      col.fields.add(new TextField({ name: 'storeWhatsapp', required: false }))
    }
    if (!col.fields.getByName('storeInstagram')) {
      col.fields.add(new TextField({ name: 'storeInstagram', required: false }))
    }
    if (!col.fields.getByName('storeAddress')) {
      col.fields.add(new TextField({ name: 'storeAddress', required: false }))
    }
    if (!col.fields.getByName('storeThankYouMessage')) {
      col.fields.add(new TextField({ name: 'storeThankYouMessage', required: false }))
    }
    if (!col.fields.getByName('storePrimaryColor')) {
      col.fields.add(new TextField({ name: 'storePrimaryColor', required: false }))
    }
    if (!col.fields.getByName('devBrandName')) {
      col.fields.add(new TextField({ name: 'devBrandName', required: false }))
    }
    if (!col.fields.getByName('devBrandWhatsapp')) {
      col.fields.add(new TextField({ name: 'devBrandWhatsapp', required: false }))
    }
    if (!col.fields.getByName('devBrandShowOnReceipt')) {
      col.fields.add(new BoolField({ name: 'devBrandShowOnReceipt', required: false }))
    }
    if (!col.fields.getByName('devBrandLandingPageUrl')) {
      col.fields.add(new TextField({ name: 'devBrandLandingPageUrl', required: false }))
    }
    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('store_settings')
      app.delete(col)
    } catch (_) {
      // already gone
    }
  },
)
