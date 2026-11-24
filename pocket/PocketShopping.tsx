// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState } from 'react';
import { BellRing, PackagePlus, ShoppingCart, Trash2, Check } from 'lucide-react';
import { getFoodEmoji } from '../foodUtils';

export default function PocketShopping({
  openShop,
  doneShop,
  cartItems,
  notifPermission,
  themeStyles,
  onRequestPushPermission,
  onAddShopItem,
  onToggleShopItem,
  onRemoveCartItem,
  onTransferSingleCartItemToStock,
  onTransferAllCartToStock,
  onMoveBoughtItemToPantry,
  onMoveAllBoughtToPantry,
  onClearDoneShopItems
}) {
  const [quickShopText, setQuickShopText] = useState('');
  const [quickMhdDays, setQuickMhdDays] = useState(7);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!quickShopText.trim()) return;
    onAddShopItem(quickShopText.trim());
    setQuickShopText('');
  };

  const sortedCart = Array.isArray(cartItems)
    ? [...cartItems].sort((a, b) => Number(b.scannedAt || 0) - Number(a.scannedAt || 0))
    : [];

  const sortedDoneShop = Array.isArray(doneShop)
    ? [...doneShop].sort((a, b) => Number(b.doneAt || 0) - Number(a.doneAt || 0))
    : [];

  return (
    <div className="space-y-3.5">
      {/* SCHNELLER EINGABE-BALKEN OBEN */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={quickShopText}
          onChange={(e) => setQuickShopText(e.target.value)}
          placeholder="Artikel auf die Einkaufsliste setzen..."
          className={'flex-1 min-h-[52px] px-4 py-3 rounded-2xl border text-base font-extrabold ' + themeStyles.input}
        />
        <button type="submit" className="tw-active-nav min-h-[52px] px-5 rounded-2xl font-black text-lg shadow-md">
          +
        </button>
      </form>

      {/* BEREICH 1: OFFENE EINKAUFSLISTE MIT GROSSER SCHRIFT & GROSSEN PRODUKT-ICONS */}
      <div className={'rounded-3xl border p-4 space-y-2.5 ' + themeStyles.card}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-black text-base">
            📝 Offene Einkaufsliste ({openShop.length})
          </div>
          <button
            type="button"
            onClick={onRequestPushPermission}
            className={'px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 ' +
              (notifPermission === 'granted' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'tw-glow-btn')}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{notifPermission === 'granted' ? 'Push aktiv ✓' : 'Push'}</span>
          </button>
        </div>

        {openShop.length === 0 ? (
          <div className="py-6 text-center text-sm opacity-55 font-bold">
            🛒 Deine Einkaufsliste ist leer!
          </div>
        ) : (
          openShop.map(item => (
            <div
              key={item.origIdx}
              onClick={() => onToggleShopItem(item.origIdx)}
              className={'p-3.5 rounded-2xl border flex items-center justify-between gap-3.5 cursor-pointer transition-all ' + themeStyles.subtle}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={false}
                  readOnly
                  className="w-6 h-6 accent-amber-500 rounded shrink-0"
                />
                {/* GROSSES PRODUKT-ICON (w-12 h-12 text-3xl) */}
                <span className="w-12 h-12 rounded-2xl bg-black/35 border border-white/10 flex items-center justify-center text-3xl shrink-0">
                  {getFoodEmoji(item.text)}
                </span>
                {/* GROSSER PRODUKT-TEXT (text-base sm:text-lg font-black) */}
                <span className="font-black text-base sm:text-lg leading-snug break-words">
                  {item.text}
                </span>
              </div>
            </div>
          ))
        )}

        {/* ABGEHAKTE EINKÄUFE */}
        {sortedDoneShop.length > 0 && (
          <div className="pt-4 mt-3.5 border-t border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-emerald-400">
                🛍️ Im Einkaufswagen abgehakt ({sortedDoneShop.length}):
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold opacity-75">MHD:</span>
                {[
                  { l: '+5T', d: 5 },
                  { l: '+1W', d: 7 },
                  { l: '+2W', d: 14 },
                  { l: '+1M', d: 30 }
                ].map(b => (
                  <button
                    key={b.d}
                    type="button"
                    onClick={() => setQuickMhdDays(b.d)}
                    className={'px-2.5 py-1 rounded-lg text-xs font-black ' + (quickMhdDays === b.d ? 'tw-active-nav' : 'tw-nav-inactive')}
                  >
                    {b.l}
                  </button>
                ))}
              </div>
            </div>

            {sortedDoneShop.map(item => (
              <div
                key={item.origIdx}
                className={'p-3 rounded-2xl border flex items-center justify-between gap-2.5 ' + themeStyles.subtle}
              >
                <div
                  onClick={() => onToggleShopItem(item.origIdx)}
                  className="flex items-center gap-3 min-w-0 flex-1 opacity-80 cursor-pointer"
                >
                  <input type="checkbox" checked={true} readOnly className="w-5 h-5 accent-emerald-500 rounded shrink-0" />
                  <span className="text-2xl shrink-0">{getFoodEmoji(item.text)}</span>
                  <span className="text-sm sm:text-base font-extrabold line-through break-words">
                    {item.text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onMoveBoughtItemToPantry(item, quickMhdDays)}
                  className="tw-glow-btn px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0"
                >
                  <PackagePlus className="w-4 h-4 text-emerald-300" />
                  <span>Bestand (+{quickMhdDays}T)</span>
                </button>
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onMoveAllBoughtToPantry(sortedDoneShop, quickMhdDays)}
                className="tw-active-nav w-full py-3.5 px-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-lg"
              >
                <PackagePlus className="w-4 h-4 shrink-0" />
                <span>📦 Alle {sortedDoneShop.length} in Bestand buchen</span>
              </button>

              {onClearDoneShopItems && (
                <button
                  type="button"
                  onClick={() => onClearDoneShopItems(sortedDoneShop)}
                  className="w-full py-3.5 px-3 rounded-2xl bg-rose-600/90 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>🗑️ Erledigte endgültig leeren</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BEREICH 2: GESCANNTE PRODUKTE IM EINKAUFSWAGEN (GROSSE DARSTELLUNG) */}
      <div className={'rounded-3xl border-2 border-amber-400/40 p-4 space-y-3 ' + themeStyles.card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-base text-amber-300 flex items-center gap-1.5">
              <ShoppingCart className="w-5 h-5" />
              <span>🛒 Gescannte Produkte ({sortedCart.length})</span>
            </h3>
            <p className="text-xs opacity-75 font-semibold">
              Aus dem Kamera-Scanner • Neuestes steht oben
            </p>
          </div>

          {sortedCart.length > 0 && (
            <button
              type="button"
              onClick={onTransferAllCartToStock}
              className="tw-active-nav px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg"
            >
              <PackagePlus className="w-4 h-4" />
              <span>📦 Alle in Bestand</span>
            </button>
          )}
        </div>

        {sortedCart.length === 0 ? (
          <div className="py-4 text-center text-xs opacity-55 font-bold">
            Noch keine Produkte im Scanner-Einkaufswagen.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedCart.map((cItem, idx) => (
              <div
                key={cItem.id}
                className={'p-3.5 rounded-2xl border flex items-center justify-between gap-3 ' +
                  (idx === 0 ? 'border-amber-400/80 bg-amber-500/10' : themeStyles.subtle)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-13 h-13 rounded-2xl bg-black/35 border border-white/10 flex items-center justify-center text-3xl shrink-0">
                    {getFoodEmoji(cItem.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {idx === 0 && (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black mb-0.5">
                        ZULETZT GESCANNT
                      </span>
                    )}
                    <div className="font-black text-base leading-snug break-words">
                      {cItem.name}
                    </div>
                    <div className="text-xs text-amber-300 font-extrabold mt-0.5">
                      {cItem.quantity} • MHD: {cItem.expiryDate.slice(8, 10)}.{cItem.expiryDate.slice(5, 7)}.{cItem.expiryDate.slice(2, 4)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTransferSingleCartItemToStock(cItem)}
                    className="tw-glow-btn px-3 py-2.5 rounded-xl text-xs font-black flex items-center gap-1"
                  >
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Bestand</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveCartItem(cItem.id)}
                    className="tw-nav-inactive p-2.5 rounded-xl text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
