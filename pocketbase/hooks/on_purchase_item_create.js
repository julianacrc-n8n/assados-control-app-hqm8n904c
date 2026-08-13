/// <reference path="../pb_data/types.d.ts" />
// After a purchase_item is created, increase the related ingredient's
// currentStock by the purchased quantity. The stock update is a side effect:
// if it fails, the purchase_item itself is still kept.
onRecordAfterCreateSuccess((e) => {
  try {
    const record = e.record
    const ingredientId = record.getString('ingredientId')
    const quantity = record.getFloat('quantity')

    if (!ingredientId || quantity <= 0) {
      e.next()
      return
    }

    const ingredient = $app.findRecordById('ingredients', ingredientId)
    if (!ingredient) {
      e.next()
      return
    }

    const current = ingredient.getFloat('currentStock')
    const next = current + quantity
    ingredient.set('currentStock', next)
    $app.save(ingredient)
  } catch (err) {
    console.log('on_purchase_item_create: failed to update stock:', err)
  }
  e.next()
}, 'purchase_items')
