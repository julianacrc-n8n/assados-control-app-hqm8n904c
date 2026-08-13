/// <reference path="../pb_data/types.d.ts" />
// After a purchase_item is deleted, reverse the stock addition that was
// applied when it was created: subtract its quantity from the related
// ingredient's currentStock (floored at 0). The stock reversal is a side
// effect — if it fails, the deletion itself must NOT be blocked.
onRecordAfterDeleteSuccess((e) => {
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
    let next = current - quantity
    if (next < 0) {
      next = 0
    }
    ingredient.set('currentStock', next)
    $app.save(ingredient)
  } catch (err) {
    // Stock reversal failed — log but do not block the deletion.
    console.log('on_purchase_item_delete: failed to reverse stock:', err)
  }
  e.next()
}, 'purchase_items')
