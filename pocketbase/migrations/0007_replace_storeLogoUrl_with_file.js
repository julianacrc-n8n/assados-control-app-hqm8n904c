/// <reference path="../pb_data/types.d.ts" />
// Replaces the `storeLogoUrl` text field with a `storeLogo` File field on the
// `store_settings` collection. The logo is now stored as an uploaded image file
// (PNG / JPEG / WebP, max 2MB, single file) instead of an external URL.
//
// Only the `store_settings` collection is modified; all other fields are kept.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('store_settings')

    // Remove the old text field if it still exists.
    col.fields.removeByName('storeLogoUrl')

    // Add the new file field only if it does not already exist.
    if (!col.fields.getByName('storeLogo')) {
      col.fields.add(
        new FileField({
          name: 'storeLogo',
          required: false,
          maxSelect: 1,
          maxSize: 2097152, // 2MB
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('store_settings')

    // Remove the file field if it exists.
    col.fields.removeByName('storeLogo')

    // Re-add the original text field if it does not exist.
    if (!col.fields.getByName('storeLogoUrl')) {
      col.fields.add(new TextField({ name: 'storeLogoUrl', required: false }))
    }

    app.save(col)
  },
)
