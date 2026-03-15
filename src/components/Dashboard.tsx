'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import HistoryAwareLink from './HistoryAwareLink';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getUser, getToken, clearToken, apiGet, apiPatch, isDemoAccount } from '../lib/auth';
import { FinanceRecentTransactionsWidget, FinanceBudgetWidget, FinanceSpendByCategoryWidget } from './FinanceWidgets';
import { useCommunityInsights, useFavorites, useFeedData, useProjects, useViewHistory } from '../lib/ShopdataContext';
import { getFeedStockStatus } from '../lib/stockStatus';

// ─── Widget registry ──────────────────────────────────────────────────────────
export interface WidgetDef {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  icon: string;
  color: string;
  description: string;
}

type CommunityMetric = 'views' | 'favorites';

interface CommunityWidgetConfig {
  id: string;
  title: string;
  description: string;
  metric: CommunityMetric;
  analyticsCategory?: string;
  analyticsSubcategory?: string;
  icon: string;
  color: string;
  linkHref: string;
  linkLabel: string;
  emptyLabel: string;
}

const BASE_WIDGETS: WidgetDef[] = [
  { id: 'active-projects', title: 'Active Projects', category: 'Projects', icon: 'rocket_launch', color: 'text-blue-500', description: 'Track all in-progress builds and flips.' },
  { id: 'recent-activity', title: 'Recently Viewed', category: 'Projects', icon: 'history', color: 'text-slate-400', description: 'Products you recently opened in vendor stores.' },
  { id: 'favorite-products', title: 'Favorites', category: 'Projects', icon: 'favorite', color: 'text-red-500', description: 'Saved products from all trackers.' },
  { id: 'keyboard-releases', title: 'Keyboard New Releases', category: 'Keyboards', icon: 'keyboard', color: 'text-emerald-500', description: 'Latest keyboard launches and group buys.' },
  { id: 'keyboard-full-release', title: 'Keyboard Full Releases', category: 'Keyboards', icon: 'keyboard', color: 'text-emerald-500', description: 'Complete keyboard kits and fully built keyboards.' },
  { id: 'keyboard-parts-release', title: 'Keyboard Parts Releases', category: 'Keyboards', icon: 'memory_alt', color: 'text-blue-500', description: 'PCBs, plates, and core keyboard parts (non-switch/keycap).' },
  { id: 'keyboard-switches', title: 'Keyboard Switches', category: 'Keyboards', icon: 'tune', color: 'text-cyan-500', description: 'Switches, springs, and switch accessories.' },
  { id: 'keyboard-accessories', title: 'Keyboard Accessories / Misc', category: 'Keyboards', icon: 'cable', color: 'text-slate-400', description: 'Oddball and miscellaneous keyboard accessories.' },
  { id: 'keycaps-tracker', title: 'Keycaps Sales Tracker', category: 'Keyboards', icon: 'format_color_text', color: 'text-emerald-500', description: 'GMK, PBT and designer keycap set alerts.' },
  { id: 'keyboard-sales', title: 'Keyboard Sales', category: 'Keyboards', icon: 'sell', color: 'text-amber-500', description: 'Live keyboard discounts and clearance deals.' },
  { id: 'keyboard-comparison', title: 'Keyboard Comparison', category: 'Keyboards', icon: 'compare', color: 'text-emerald-400', description: 'Side-by-side keyboard spec comparison.' },
  { id: 'ram-availability', title: 'RAM Availability', category: 'PC Building', icon: 'memory', color: 'text-purple-500', description: 'DDR4/DDR5 stock level monitor.' },
  { id: 'gpu-availability', title: 'GPU Availability', category: 'PC Building', icon: 'videogame_asset', color: 'text-green-500', description: 'RTX/RX GPU stock level monitor across retailers.' },
  { id: 'cpu-availability', title: 'CPU Availability', category: 'PC Building', icon: 'memory_alt', color: 'text-blue-500', description: 'AMD Ryzen / Intel Core CPU stock monitor.' },
  { id: 'pc-deals', title: 'PC Deals', category: 'PC Building', icon: 'sell', color: 'text-orange-500', description: 'Live PC component deals from r/buildapcsales and price trackers.' },
  { id: 'active-deals', title: 'Active Deals', category: 'Electronics', icon: 'sell', color: 'text-orange-500', description: 'Live price drops and limited-time offers.' },
  { id: 'electronics-watchlist',       title: 'Electronics Watchlist',       category: 'Electronics', icon: 'devices',               color: 'text-blue-400',   description: 'DigiKey / Mouser tracked parts.' },
  { id: 'electronics-new-drops',       title: 'Electronics New Drops',       category: 'Electronics', icon: 'new_releases',          color: 'text-green-500',  description: 'Latest component and maker releases.' },
  { id: 'electronics-sales',           title: 'Electronics Sales',           category: 'Electronics', icon: 'sell',                  color: 'text-amber-500',  description: 'Discounted electronics and components.' },
  { id: 'electronics-microcontrollers',title: 'Microcontrollers',            category: 'Electronics', icon: 'developer_board',       color: 'text-blue-500',   description: 'MCU availability: Adafruit, Mouser, DigiKey.' },
  { id: 'electronics-passives',        title: 'Passives',                    category: 'Electronics', icon: 'electric_bolt',         color: 'text-slate-400',  description: 'Resistors, capacitors, and inductors in stock.' },
  { id: 'electronics-sensors',         title: 'Sensors',                     category: 'Electronics', icon: 'sensors',               color: 'text-purple-500', description: 'Temperature, motion, and environmental sensors.' },
  { id: 'electronics-motors',          title: 'Motors & Actuators',          category: 'Electronics', icon: 'settings_motion_mode',  color: 'text-orange-500', description: 'Steppers, servos, and DC motors.' },
  { id: 'electronics-ics',             title: 'ICs & Breakout Boards',       category: 'Electronics', icon: 'memory_alt',            color: 'text-cyan-500',   description: 'Op-amps, logic gates and breakout boards.' },
  { id: 'electronics-encoders',        title: 'Encoders & Potentiometers',   category: 'Electronics', icon: 'rotate_right',          color: 'text-pink-500',   description: 'Rotary encoders and potentiometers.' },
  { id: 'electronics-power',           title: 'Power & Regulators',          category: 'Electronics', icon: 'bolt',                  color: 'text-yellow-500', description: 'Voltage regulators, power modules and charging ICs.' },
  { id: 'electronics-connectors',      title: 'Connectors & Cables',         category: 'Electronics', icon: 'cable',                 color: 'text-blue-400',   description: 'Connectors, headers, and cable assemblies.' },
  { id: 'electronics-displays',        title: 'Displays & Screens',          category: 'Electronics', icon: 'tv',                    color: 'text-teal-500',   description: 'OLED, LCD, and e-paper display modules.' },
  { id: 'electronics-wireless',        title: 'Wireless & RF',               category: 'Electronics', icon: 'wifi',                  color: 'text-green-400',  description: 'WiFi, Bluetooth, LoRa, and RF modules.' },
  { id: 'electronics-audio',           title: 'Audio & Sound',               category: 'Electronics', icon: 'mic',                   color: 'text-pink-400',   description: 'Microphones, amplifiers, and audio modules.' },
  { id: 'inventory-stats', title: 'Inventory Stats', category: 'Overview', icon: 'inventory_2', color: 'text-blue-500', description: 'High-level stock and project counts.' },
  { id: 'vendor-performance', title: 'Vendor Performance', category: 'Overview', icon: 'storefront', color: 'text-yellow-500', description: 'Fulfillment rates across top vendors.' },

  // ─── Garden ───────────────────────────────────────────────────────────────────
  { id: 'garden-new-arrivals',  title: 'Garden New Arrivals',   category: 'Garden',                        icon: 'new_releases',        color: 'text-green-500',   description: 'New plants, seeds & tools from top garden retailers.' },
  { id: 'garden-deals',         title: 'Garden Deals',          category: 'Garden',                        icon: 'sell',                color: 'text-amber-500',   description: 'Discounts & sales on garden products.' },
  { id: 'garden-houseplants',   title: 'Houseplants',           category: 'Garden',  subcategory: 'Houseplants', icon: 'potted_plant',  color: 'text-emerald-500', description: 'Indoor plants and houseplant care supplies.' },
  { id: 'garden-trees-shrubs',  title: 'Trees & Shrubs',        category: 'Garden',  subcategory: 'Trees & Shrubs', icon: 'park',       color: 'text-teal-500',    description: 'Hardy trees and shrubs — zone-filtered when your zone is set.' },
  { id: 'garden-perennials',    title: 'Perennials',            category: 'Garden',  subcategory: 'Perennials', icon: 'grass',          color: 'text-green-400',   description: 'Perennial plants — zone-filtered to your hardiness zone.' },
  { id: 'garden-seeds',         title: 'Seeds',                 category: 'Garden',  subcategory: 'Seeds',    icon: 'compost',          color: 'text-lime-500',    description: 'Vegetable, flower & herb seeds.' },
  { id: 'garden-tools',         title: 'Garden Tools',          category: 'Garden',  subcategory: 'Tools',    icon: 'construction',     color: 'text-orange-400',  description: 'Pruners, spades, trowels & garden tools.' },

  // ─── Groceries ────────────────────────────────────────────────────────────────
  { id: 'grocery-deals',        title: 'Weekly Deals',          category: 'Groceries',                     icon: 'sell',                color: 'text-amber-500',   description: 'Kroger weekly sales and promotions.' },
  { id: 'grocery-produce',      title: 'Fresh Produce',         category: 'Groceries',                     icon: 'nutrition',           color: 'text-green-500',   description: 'Fresh fruits, vegetables and produce.' },
  { id: 'grocery-staples',      title: 'Pantry Staples',        category: 'Groceries',                     icon: 'kitchen',             color: 'text-yellow-600',  description: 'Pantry essentials and dry goods.' },
  { id: 'grocery-meat-seafood', title: 'Meat & Seafood',        category: 'Groceries',                     icon: 'set_meal',            color: 'text-red-500',     description: 'Fresh meat and seafood from Kroger.' },

  // ─── Sports Equipment ─────────────────────────────────────────────────────────
  { id: 'sports-baseball',      title: 'Baseball',              category: 'Sports Equipment', subcategory: 'Baseball',   icon: 'sports_baseball',     color: 'text-red-600',     description: 'Baseball bats, gloves & equipment.' },
  { id: 'sports-basketball',    title: 'Basketball',            category: 'Sports Equipment', subcategory: 'Basketball', icon: 'sports_basketball',   color: 'text-orange-500',  description: 'Basketballs, hoops & gear.' },
  { id: 'sports-football',      title: 'Football',              category: 'Sports Equipment', subcategory: 'Football',   icon: 'sports_football',     color: 'text-slate-700',   description: 'Footballs, pads & equipment.' },
  { id: 'sports-soccer',        title: 'Soccer',                category: 'Sports Equipment', subcategory: 'Soccer',     icon: 'sports_soccer',       color: 'text-green-600',   description: 'Soccer balls, cleats & gear.' },
  { id: 'sports-volleyball',    title: 'Volleyball',            category: 'Sports Equipment', subcategory: 'Volleyball', icon: 'sports_volleyball',   color: 'text-yellow-500',  description: 'Volleyballs, nets & accessories.' },
  { id: 'sports-deals',         title: 'Sports Deals',          category: 'Sports Equipment',              icon: 'sell',                color: 'text-amber-500',   description: 'Deals across all sports categories.' },
  { id: 'sports-new-releases',  title: 'New Equipment',         category: 'Sports Equipment',              icon: 'new_releases',        color: 'text-blue-500',    description: 'Latest sports equipment releases.' },

  // ─── 3D Printing ─────────────────────────────────────────────────────────────
  { id: '3dp-printers',         title: '3D Printers',           category: '3D Printing',                   icon: 'print',               color: 'text-blue-500',    description: 'FDM and resin 3D printer deals and releases.' },
  { id: '3dp-filament',         title: 'Filament',              category: '3D Printing',                   icon: 'cable',               color: 'text-yellow-400',  description: 'PLA, PETG, ABS and specialty filament.' },
  { id: '3dp-resins',           title: 'Resins',                category: '3D Printing',                   icon: 'science',             color: 'text-purple-500',  description: 'Standard and engineering resins for SLA/MSLA printers.' },
  { id: '3dp-accessories',      title: 'Accessories & Upgrades', category: '3D Printing',                  icon: 'build',               color: 'text-slate-400',   description: 'Nozzles, build plates, enclosures & upgrades.' },
  { id: '3dp-deals',            title: '3D Printing Deals',     category: '3D Printing',                   icon: 'sell',                color: 'text-amber-500',   description: 'Sales on printers, filament & accessories.' },

  // ─── Automotive ──────────────────────────────────────────────────────────────
  { id: 'auto-parts',           title: 'Auto Parts',            category: 'Automotive',                    icon: 'directions_car',      color: 'text-blue-500',    description: 'OEM and aftermarket auto parts.' },
  { id: 'auto-tools',           title: 'Tools & Equipment',     category: 'Automotive',                    icon: 'build',               color: 'text-orange-400',  description: 'Jacks, ratchets & diagnostic tools.' },
  { id: 'auto-accessories',     title: 'Car Accessories',       category: 'Automotive',                    icon: 'auto_awesome',        color: 'text-teal-400',    description: 'Interior, exterior & tech accessories.' },
  { id: 'auto-deals',           title: 'Auto Deals',            category: 'Automotive',                    icon: 'sell',                color: 'text-amber-500',   description: 'Deals on parts, tools & accessories.' },

  // ─── Games ───────────────────────────────────────────────────────────────────
  { id: 'games-video-deals',    title: 'Video Game Deals',      category: 'Games',                         icon: 'sports_esports',      color: 'text-purple-500',  description: 'Steam, Epic, Humble & more game deals.' },
  { id: 'games-video-new',      title: 'New Video Games',       category: 'Games',                         icon: 'new_releases',        color: 'text-blue-500',    description: 'New releases across PC, console & mobile.' },
  { id: 'games-board-new',      title: 'New Board Games',       category: 'Games',  subcategory: 'Board Games', icon: 'casino',        color: 'text-green-500',   description: 'New board game releases from BGG hotness.' },
  { id: 'games-board-deals',    title: 'Board Game Deals',      category: 'Games',  subcategory: 'Board Games', icon: 'sell',          color: 'text-amber-500',   description: 'Discounts on board games and expansions.' },
  { id: 'games-tabletop',       title: 'Tabletop & RPG',        category: 'Games',  subcategory: 'Tabletop/RPG', icon: 'casino',       color: 'text-red-500',     description: 'Tabletop RPGs, miniatures & accessories.' },
  { id: 'games-deals',          title: 'All Games Deals',       category: 'Games',                         icon: 'sell',                color: 'text-orange-400',  description: 'Combined deals across video and board games.' },

  // ─── Home ────────────────────────────────────────────────────────────────────
  { id: 'home-decor',           title: 'Home Decor',            category: 'Home',                          icon: 'home',                color: 'text-rose-500',    description: 'Decor, rugs, lighting & accents.' },
  { id: 'home-furniture',       title: 'Furniture',             category: 'Home',                          icon: 'chair',               color: 'text-amber-800',   description: 'Sofas, tables, chairs & shelving.' },
  { id: 'home-kitchen',         title: 'Kitchen & Appliances',  category: 'Home',                          icon: 'kitchen',             color: 'text-yellow-600',  description: 'Cookware, appliances & kitchen gadgets.' },
  { id: 'home-deals',           title: 'Home Deals',            category: 'Home',                          icon: 'sell',                color: 'text-amber-500',   description: 'Deals across home decor, furniture & kitchen.' },

  // ─── Home Improvement ────────────────────────────────────────────────────────
  { id: 'homeimprove-tools',     title: 'Power & Hand Tools',    category: 'Home Improvement', subcategory: 'Tools',       icon: 'hardware',            color: 'text-orange-500',  description: 'Drills, saws, wrenches & hand tools.' },
  { id: 'homeimprove-materials', title: 'Building Materials',    category: 'Home Improvement', subcategory: 'Materials',   icon: 'foundation',          color: 'text-slate-500',   description: 'Lumber, drywall, concrete & building supplies.' },
  { id: 'homeimprove-plumbing',  title: 'Plumbing',              category: 'Home Improvement', subcategory: 'Plumbing',    icon: 'water_pump',          color: 'text-blue-400',    description: 'Pipes, fittings, faucets & plumbing supplies.' },
  { id: 'homeimprove-electrical',title: 'Electrical',            category: 'Home Improvement', subcategory: 'Electrical',  icon: 'electrical_services', color: 'text-yellow-400',  description: 'Wire, breakers, outlets & electrical supplies.' },
  { id: 'homeimprove-deals',     title: 'DIY Deals',             category: 'Home Improvement',              icon: 'sell',                color: 'text-amber-500',   description: 'Deals on tools and home improvement supplies.' },

  // ─── Clothes ─────────────────────────────────────────────────────────────────
  { id: 'clothes-mens',         title: "Men's Clothing",         category: 'Clothes',  subcategory: "Men's",     icon: 'man',                 color: 'text-blue-500',    description: "Men's fashion deals and new arrivals." },
  { id: 'clothes-womens',       title: "Women's Clothing",       category: 'Clothes',  subcategory: "Women's",   icon: 'woman',               color: 'text-pink-500',    description: "Women's fashion deals and new arrivals." },
  { id: 'clothes-activewear',   title: 'Activewear',             category: 'Clothes',  subcategory: 'Activewear', icon: 'fitness_center',     color: 'text-green-500',   description: 'Sports and exercise apparel deals.' },
  { id: 'clothes-deals',        title: 'Clothing Deals',         category: 'Clothes',                       icon: 'sell',                color: 'text-amber-500',   description: 'Deals across all clothing categories.' },
  { id: 'clothes-new',          title: 'New Arrivals',           category: 'Clothes',                       icon: 'new_releases',        color: 'text-slate-400',   description: 'Latest fashion arrivals from top retailers.' },

  // ─── Shoes ───────────────────────────────────────────────────────────────────
  { id: 'shoes-athletic',       title: 'Athletic & Running',    category: 'Shoes',  subcategory: 'Athletic', icon: 'sprint',               color: 'text-blue-500',    description: 'Running shoes, cross-trainers & athletic footwear.' },
  { id: 'shoes-casual',         title: 'Casual & Lifestyle',    category: 'Shoes',  subcategory: 'Casual',   icon: 'footprint',            color: 'text-slate-400',   description: 'Sneakers, boots & everyday shoes.' },
  { id: 'shoes-deals',          title: 'Shoe Deals',            category: 'Shoes',                          icon: 'sell',                 color: 'text-amber-500',   description: 'Deals across all footwear types.' },
  { id: 'shoes-new',            title: 'New Releases',          category: 'Shoes',                          icon: 'new_releases',         color: 'text-green-500',   description: 'Latest sneaker and shoe releases.' },

  // ─── Art ─────────────────────────────────────────────────────────────────────
  { id: 'art-supplies-new',     title: 'New Art Supplies',       category: 'Art',                           icon: 'palette',             color: 'text-purple-500',  description: 'New paints, canvases, brushes & art supplies.' },
  { id: 'art-supplies-deals',   title: 'Art Supply Deals',       category: 'Art',                           icon: 'sell',                color: 'text-amber-500',   description: 'Deals on art materials and supplies.' },
  { id: 'art-prints',           title: 'Prints & Originals',     category: 'Art',                           icon: 'image',               color: 'text-rose-400',    description: 'Art prints, originals & wall art.' },

  // ─── Crafts ──────────────────────────────────────────────────────────────────
  { id: 'crafts-pottery',       title: 'Pottery',                category: 'Crafts', subcategory: 'Pottery',  icon: 'blur_circular',       color: 'text-orange-400',  description: 'Clay, kilns & pottery supplies.' },
  { id: 'crafts-weaving',       title: 'Weaving & Fiber Arts',   category: 'Crafts', subcategory: 'Weaving',  icon: 'grid_on',             color: 'text-teal-500',    description: 'Looms, yarn & weaving supplies.' },
  { id: 'crafts-deals',         title: 'Craft Deals',            category: 'Crafts',                        icon: 'sell',                color: 'text-amber-500',   description: 'Deals on craft supplies from JOANN, Michaels & more.' },

  // ─── Needle Work ─────────────────────────────────────────────────────────────
  { id: 'needlework-knitting',  title: 'Knitting',               category: 'Needle Work', subcategory: 'Knitting',  icon: 'texture',            color: 'text-purple-400',  description: 'Yarn, needles & knitting patterns.' },
  { id: 'needlework-crochet',   title: 'Crochet',                category: 'Needle Work', subcategory: 'Crochet',   icon: 'gesture',            color: 'text-pink-400',    description: 'Yarn, hooks & crochet supplies.' },
  { id: 'needlework-quilting',  title: 'Quilting',               category: 'Needle Work', subcategory: 'Quilting',  icon: 'grid_4x4',           color: 'text-rose-500',    description: 'Fabric, batting & quilting tools.' },
  { id: 'needlework-deals',     title: 'Needle Work Deals',      category: 'Needle Work',                   icon: 'sell',                color: 'text-amber-500',   description: 'Deals on yarn, hooks & sewing supplies.' },

  // ─── Finance ─────────────────────────────────────────────────────────────────
  { id: 'finance-recent-transactions', title: 'Recent Transactions',   category: 'Finance', icon: 'receipt_long',    color: 'text-blue-500',   description: 'Latest imported bank transactions.' },
  { id: 'finance-budget',              title: 'Monthly Budgets',        category: 'Finance', icon: 'savings',         color: 'text-emerald-500',description: 'Track spend vs budget per category.' },
  { id: 'finance-spend-by-category',   title: 'Spend by Category',      category: 'Finance', icon: 'bar_chart',       color: 'text-purple-500', description: 'Bar chart of this month\'s spending by ShopDeck category.' },
];

const COMMUNITY_WIDGET_CONFIGS: CommunityWidgetConfig[] = [
  {
    id: 'community-popular-overall',
    title: 'Popular Items Overall',
    description: 'Most viewed shared products across the app.',
    metric: 'views',
    icon: 'trending_up',
    color: 'text-blue-500',
    linkHref: '/recently-viewed',
    linkLabel: 'View your history →',
    emptyLabel: 'No shared history data yet.',
  },
  {
    id: 'community-favorites-overall',
    title: 'Frequently Favorited Overall',
    description: 'Most favorited shared products across the app.',
    metric: 'favorites',
    icon: 'favorite',
    color: 'text-red-500',
    linkHref: '/favorites',
    linkLabel: 'View your favorites →',
    emptyLabel: 'No shared favorites data yet.',
  },
  {
    id: 'community-popular-keyboards',
    title: 'Popular Keyboard Items',
    description: 'Shared keyboard products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'keyboards',
    icon: 'keyboard',
    color: 'text-emerald-500',
    linkHref: '/drops',
    linkLabel: 'Browse keyboard feeds →',
    emptyLabel: 'No shared keyboard views yet.',
  },
  {
    id: 'community-favorites-keyboards',
    title: 'Frequently Favorited Keyboards',
    description: 'Keyboard products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'keyboards',
    icon: 'keyboard',
    color: 'text-emerald-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared keyboard favorites yet.',
  },
  {
    id: 'community-popular-electronics',
    title: 'Popular Electronics Items',
    description: 'Shared electronics products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    icon: 'developer_board',
    color: 'text-cyan-500',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared electronics views yet.',
  },
  {
    id: 'community-favorites-electronics',
    title: 'Frequently Favorited Electronics',
    description: 'Electronics products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    icon: 'developer_board',
    color: 'text-cyan-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared electronics favorites yet.',
  },
  {
    id: 'community-popular-keycaps',
    title: 'Popular Keycaps',
    description: 'Shared keycap products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'keycaps',
    icon: 'format_color_text',
    color: 'text-emerald-500',
    linkHref: '/keycaps-tracker',
    linkLabel: 'Open keycaps tracker →',
    emptyLabel: 'No shared keycap views yet.',
  },
  {
    id: 'community-favorites-keycaps',
    title: 'Frequently Favorited Keycaps',
    description: 'Keycap products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'keycaps',
    icon: 'format_color_text',
    color: 'text-emerald-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared keycap favorites yet.',
  },
  {
    id: 'community-popular-full-keyboards',
    title: 'Popular Full Keyboards',
    description: 'Shared keyboard kits and complete boards with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'full',
    icon: 'keyboard',
    color: 'text-emerald-500',
    linkHref: '/drops',
    linkLabel: 'Browse keyboard feeds →',
    emptyLabel: 'No shared full keyboard views yet.',
  },
  {
    id: 'community-favorites-full-keyboards',
    title: 'Frequently Favorited Full Keyboards',
    description: 'Keyboard kits and complete boards users save most often.',
    metric: 'favorites',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'full',
    icon: 'keyboard',
    color: 'text-emerald-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared full keyboard favorites yet.',
  },
  {
    id: 'community-popular-keyboard-parts',
    title: 'Popular Keyboard Parts',
    description: 'Shared PCBs, plates, and keyboard parts with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'parts',
    icon: 'memory_alt',
    color: 'text-blue-500',
    linkHref: '/drops',
    linkLabel: 'Browse keyboard parts →',
    emptyLabel: 'No shared keyboard parts views yet.',
  },
  {
    id: 'community-favorites-keyboard-parts',
    title: 'Frequently Favorited Keyboard Parts',
    description: 'Keyboard parts users save most often.',
    metric: 'favorites',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'parts',
    icon: 'memory_alt',
    color: 'text-blue-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared keyboard parts favorites yet.',
  },
  {
    id: 'community-popular-keyboard-switches',
    title: 'Popular Keyboard Switches',
    description: 'Shared switch products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'switches',
    icon: 'tune',
    color: 'text-cyan-500',
    linkHref: '/drops',
    linkLabel: 'Browse switch feeds →',
    emptyLabel: 'No shared switch views yet.',
  },
  {
    id: 'community-favorites-keyboard-switches',
    title: 'Frequently Favorited Switches',
    description: 'Switch products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'switches',
    icon: 'tune',
    color: 'text-cyan-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared switch favorites yet.',
  },
  {
    id: 'community-popular-keyboard-accessories',
    title: 'Popular Keyboard Accessories',
    description: 'Shared keyboard accessories with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'accessories',
    icon: 'cable',
    color: 'text-slate-400',
    linkHref: '/drops',
    linkLabel: 'Browse accessory feeds →',
    emptyLabel: 'No shared accessory views yet.',
  },
  {
    id: 'community-favorites-keyboard-accessories',
    title: 'Frequently Favorited Accessories',
    description: 'Keyboard accessories users save most often.',
    metric: 'favorites',
    analyticsCategory: 'keyboards',
    analyticsSubcategory: 'accessories',
    icon: 'cable',
    color: 'text-slate-400',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared accessory favorites yet.',
  },
  {
    id: 'community-popular-ram',
    title: 'Popular RAM',
    description: 'Shared RAM products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'ram',
    icon: 'memory',
    color: 'text-purple-500',
    linkHref: '/ram-availability-tracker',
    linkLabel: 'Open RAM tracker →',
    emptyLabel: 'No shared RAM views yet.',
  },
  {
    id: 'community-favorites-ram',
    title: 'Frequently Favorited RAM',
    description: 'RAM products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'ram',
    icon: 'memory',
    color: 'text-purple-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared RAM favorites yet.',
  },
  {
    id: 'community-popular-gpu',
    title: 'Popular GPUs',
    description: 'Shared GPU products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'gpu',
    icon: 'videogame_asset',
    color: 'text-green-500',
    linkHref: '/gpu-availability-tracker',
    linkLabel: 'Open GPU tracker →',
    emptyLabel: 'No shared GPU views yet.',
  },
  {
    id: 'community-favorites-gpu',
    title: 'Frequently Favorited GPUs',
    description: 'GPU products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'gpu',
    icon: 'videogame_asset',
    color: 'text-green-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared GPU favorites yet.',
  },
  {
    id: 'community-popular-microcontrollers',
    title: 'Popular Microcontrollers',
    description: 'Shared MCU products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'microcontrollers',
    icon: 'developer_board',
    color: 'text-blue-500',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared microcontroller views yet.',
  },
  {
    id: 'community-favorites-microcontrollers',
    title: 'Frequently Favorited Microcontrollers',
    description: 'MCU products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'microcontrollers',
    icon: 'developer_board',
    color: 'text-blue-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared microcontroller favorites yet.',
  },
  {
    id: 'community-popular-passives',
    title: 'Popular Passives',
    description: 'Shared passive components with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'passives',
    icon: 'electric_bolt',
    color: 'text-slate-400',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared passives views yet.',
  },
  {
    id: 'community-favorites-passives',
    title: 'Frequently Favorited Passives',
    description: 'Passive components users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'passives',
    icon: 'electric_bolt',
    color: 'text-slate-400',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared passives favorites yet.',
  },
  {
    id: 'community-popular-sensors',
    title: 'Popular Sensors',
    description: 'Shared sensor products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'sensors',
    icon: 'sensors',
    color: 'text-purple-500',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared sensor views yet.',
  },
  {
    id: 'community-favorites-sensors',
    title: 'Frequently Favorited Sensors',
    description: 'Sensor products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'sensors',
    icon: 'sensors',
    color: 'text-purple-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared sensor favorites yet.',
  },
  {
    id: 'community-popular-motors',
    title: 'Popular Motors & Actuators',
    description: 'Shared motors and actuators with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'motors',
    icon: 'settings_motion_mode',
    color: 'text-orange-500',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared motor views yet.',
  },
  {
    id: 'community-favorites-motors',
    title: 'Frequently Favorited Motors',
    description: 'Motors and actuators users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'motors',
    icon: 'settings_motion_mode',
    color: 'text-orange-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared motor favorites yet.',
  },
  {
    id: 'community-popular-ics',
    title: 'Popular ICs & Breakouts',
    description: 'Shared IC and breakout products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'ics',
    icon: 'memory_alt',
    color: 'text-cyan-500',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared IC views yet.',
  },
  {
    id: 'community-favorites-ics',
    title: 'Frequently Favorited ICs & Breakouts',
    description: 'IC and breakout products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'ics',
    icon: 'memory_alt',
    color: 'text-cyan-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared IC favorites yet.',
  },
  {
    id: 'community-popular-encoders',
    title: 'Popular Encoders & Pots',
    description: 'Shared encoder and potentiometer products with the most unique viewers.',
    metric: 'views',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'encoders',
    icon: 'rotate_right',
    color: 'text-pink-500',
    linkHref: '/electronics',
    linkLabel: 'Open electronics →',
    emptyLabel: 'No shared encoder views yet.',
  },
  {
    id: 'community-favorites-encoders',
    title: 'Frequently Favorited Encoders & Pots',
    description: 'Encoder and potentiometer products users save most often.',
    metric: 'favorites',
    analyticsCategory: 'electronics',
    analyticsSubcategory: 'encoders',
    icon: 'rotate_right',
    color: 'text-pink-500',
    linkHref: '/favorites',
    linkLabel: 'Open favorites →',
    emptyLabel: 'No shared encoder favorites yet.',
  },
];

const COMMUNITY_WIDGETS: WidgetDef[] = COMMUNITY_WIDGET_CONFIGS.map(({ id, title, description, icon, color }) => ({
  id,
  title,
  category: 'Community',
  icon,
  color,
  description,
}));

const COMMUNITY_WIDGET_CONFIG_BY_ID = new Map(COMMUNITY_WIDGET_CONFIGS.map(cfg => [cfg.id, cfg]));

export const ALL_WIDGETS: WidgetDef[] = [...BASE_WIDGETS, ...COMMUNITY_WIDGETS];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="h-9 w-9 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactListSkeleton({ n = 4, iconClassName = 'h-9 w-9 rounded bg-slate-200 dark:bg-slate-700 shrink-0' }: { n?: number; iconClassName?: string }) {
  return (
    <div className="p-4 space-y-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className={iconClassName} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function WidgetFooterLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="px-4 py-3">
      <Link href={href} className="text-xs font-bold text-blue-500 hover:underline">{label}</Link>
    </div>
  );
}

function WidgetIconEmptyState({
  icon,
  message,
  action,
}: {
  icon: string;
  message: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-6 text-center text-slate-400 text-sm">
      <span className="material-symbols-outlined block text-3xl mb-2">{icon}</span>
      <p>{message}</p>
      {action}
    </div>
  );
}

function communityLabel(value?: string) {
  if (!value) return null;
  const labels: Record<string, string> = {
    keyboards: 'Keyboards',
    electronics: 'Electronics',
    full: 'Full Keyboards',
    parts: 'Keyboard Parts',
    switches: 'Switches',
    accessories: 'Accessories',
    keycaps: 'Keycaps',
    ram: 'RAM',
    gpu: 'GPU',
    microcontrollers: 'Microcontrollers',
    passives: 'Passives',
    sensors: 'Sensors',
    motors: 'Motors & Actuators',
    ics: 'ICs & Breakouts',
    encoders: 'Encoders & Pots',
    power: 'Power',
    connectors: 'Connectors',
    displays: 'Displays',
    wireless: 'Wireless',
    audio: 'Audio',
    general: 'General',
  };
  return labels[value] ?? value;
}

function summarizeSourceErrors(
  sources: Record<string, { error: string | null }>,
  options: { rateLimitLabel: string; blockedLabel: string; maxLen?: number },
) {
  const { rateLimitLabel, blockedLabel, maxLen = 60 } = options;
  const sourceErrors = Object.values(sources)
    .filter(s => s.error)
    .map(s => s.error as string);

  return [...new Set(sourceErrors.map(error =>
    error.startsWith('Rate limit') ? rateLimitLabel :
    error.startsWith('Access denied') ? blockedLabel :
    error.startsWith('HTTP 4') ? error.slice(0, 30) :
    error.slice(0, maxLen)
  ))];
}

function FeedWidgetEmptyState({
  error,
  sourceErrors,
  emptyLabel,
  linkHref,
  linkLabel,
}: {
  error: string | null;
  sourceErrors: string[];
  emptyLabel: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="px-4 py-6 text-center text-slate-400 text-sm">
      {error
        ? <p className="text-red-400 text-xs mb-1">{error}</p>
        : sourceErrors.length > 0
          ? <>
              <p className="mb-1">Sources unavailable:</p>
              {sourceErrors.slice(0, 2).map(message => (
                <p key={message} className="text-[10px] text-slate-500 mb-0.5">{message}</p>
              ))}
            </>
          : <p>{emptyLabel}</p>
      }
      <div className="mt-2"><Link href={linkHref} className="text-xs font-bold text-blue-500 hover:underline">{linkLabel}</Link></div>
    </div>
  );
}

function formatDisplayPrice(price?: string) {
  if (!price) return null;
  return price.startsWith('$') ? price : `$${price}`;
}

function parseNumericPrice(value?: string) {
  return parseFloat((value ?? '').replace(/[^0-9.]/g, '')) || 0;
}

type DashboardRowLinkItem = {
  name: string;
  url: string;
  image?: string;
  price?: string;
  vendor?: string;
  category?: string;
};

function DashboardItemRow({
  image,
  title,
  url,
  item,
  vendor,
  badges,
  fallbackIcon,
  rightTop,
  rightBottom,
  rightBottomSecondary,
}: {
  image?: string;
  title: string;
  url?: string;
  item?: DashboardRowLinkItem;
  vendor?: string;
  badges?: Array<{ label: string; className: string }>;
  fallbackIcon: string;
  rightTop?: string | null;
  rightBottom?: string | null;
  rightBottomSecondary?: string | null;
}) {
  const row = (
    <div className="flex gap-3 items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <div className="h-10 w-10 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
        {image
          ? <img src={image} alt={title} className="h-full w-full object-cover" />
          : <span className="material-symbols-outlined text-slate-400 text-lg">{fallbackIcon}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
          {vendor && <span>{vendor}</span>}
          {(badges ?? []).map((badge, index) => (
            <span key={`${badge.label}-${index}`} className={badge.className}>{badge.label}</span>
          ))}
        </div>
      </div>
      {(rightTop || rightBottom || rightBottomSecondary) && (
        <div className="shrink-0 text-right">
          {rightTop && <p className="text-sm font-bold text-blue-500">{rightTop}</p>}
          {rightBottom && <p className="text-[10px] text-slate-500">{rightBottom}</p>}
          {rightBottomSecondary && <p className="text-[10px] text-slate-400">{rightBottomSecondary}</p>}
        </div>
      )}
    </div>
  );

  if (url && item) {
    return (
      <HistoryAwareLink href={url} item={item} className="block">
        {row}
      </HistoryAwareLink>
    );
  }

  return row;
}

function FeedProductRow({
  name,
  url,
  item,
  vendor,
  price,
  badge,
}: {
  name: string;
  url?: string;
  item?: DashboardRowLinkItem;
  vendor?: string;
  price: string;
  badge?: { label: string; className: string };
}) {
  const row = (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <div className="min-w-0 mr-2">
        <p className="text-sm font-semibold line-clamp-1">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[10px] text-slate-500">{vendor}</p>
          {badge && <span className={badge.className}>{badge.label}</span>}
        </div>
      </div>
      <span className="text-sm font-bold text-blue-500 shrink-0">{price}</span>
    </div>
  );

  if (url && item) {
    return (
      <HistoryAwareLink href={url} item={item} className="block">
        {row}
      </HistoryAwareLink>
    );
  }

  return row;
}

function KeyboardComparisonSkeleton() {
  return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyboardComparisonTable({
  cards,
  rows,
}: {
  cards: Array<{ key: string; name: string; vendor?: string; values: Record<string, string> }>;
  rows: Array<{ label: string; key: string }>;
}) {
  return (
    <div className="p-4">
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `140px repeat(${cards.length}, 1fr)` }}>
        <div />
        {cards.map(card => (
          <div key={card.key} className="min-w-0">
            <p className="text-xs font-bold truncate">{card.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{card.vendor}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {rows.map(row => (
          <div key={row.key} className="grid gap-3 py-1 border-t border-slate-100 dark:border-slate-800"
            style={{ gridTemplateColumns: `140px repeat(${cards.length}, 1fr)` }}>
            <span className="text-[10px] font-medium text-slate-500 flex items-center">{row.label}</span>
            {cards.map(card => {
              const value = card.values[row.key] ?? '—';
              return (
                <span key={card.key} className="text-[11px] font-semibold flex items-center text-slate-700 dark:text-slate-300">{value}</span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Link href="/keyboard-comparison" className="text-xs font-bold text-blue-500 hover:underline">Full comparison →</Link>
      </div>
    </div>
  );
}

type InventoryStat = {
  icon: string;
  bg: string;
  label: string;
  value: string;
  badge: string;
  badgeCls: string;
};

function InventoryStatsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 animate-pulse">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
          <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700 mb-2" />
          <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-1" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function InventoryStatCard({ stat }: { stat: InventoryStat }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-1.5 rounded-lg ${stat.bg}`}>
          <span className="material-symbols-outlined text-[18px]">{stat.icon}</span>
        </div>
        <span className={`text-[10px] font-bold ${stat.badgeCls}`}>{stat.badge}</span>
      </div>
      <p className="text-[10px] font-medium text-slate-500">{stat.label}</p>
      <h3 className="text-xl font-bold mt-0.5">{stat.value}</h3>
    </div>
  );
}

// ─── Widget sub-components (each calls hooks at top level) ────────────────────
function ActiveProjectsWidget() {
  const { projects, loading } = useProjects();
  if (loading) return <SkeletonRows />;
  const active = projects.slice(0, 3);
  if (active.length === 0) {
    return (
      <WidgetIconEmptyState
        icon="rocket_launch"
        message={<>No projects yet. <Link href="/projects" className="text-blue-500 hover:underline">Create one →</Link></>}
      />
    );
  }
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {active.map(p => {
        const progress = p.total > 0 ? Math.round((p.sourced / p.total) * 100) : 0;
        const statusCls = p.forSale
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
        const dotCls = p.forSale ? 'bg-emerald-500' : 'bg-blue-500';
        const barCls = progress >= 70 ? 'bg-emerald-500' : progress >= 30 ? 'bg-blue-500' : 'bg-orange-500';
        return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <div className="h-9 w-9 rounded flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/10">
              <span className="material-symbols-outlined text-[18px]">{p.icon || 'inventory_2'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p className="text-[10px] text-slate-500">{p.status}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />{p.forSale ? 'For Sale' : 'In Stock'}
              </span>
              <div className="w-20 hidden md:block">
                <div className="flex justify-between text-[10px] font-bold mb-0.5">
                  <span>{progress}%</span>
                </div>
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
                  <div className={`h-full ${barCls} rounded-full`} style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <WidgetFooterLink href="/projects" label="View all projects →" />
    </div>
  );
}

function RecentActivityWidget() {
  const { viewHistory, loading } = useViewHistory();
  if (loading) return <CompactListSkeleton iconClassName="size-2 mt-1.5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />;
  if (viewHistory.length === 0) return <WidgetIconEmptyState icon="history" message="No recently viewed products yet." />;
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {viewHistory.slice(0, 5).map((item) => (
        <DashboardItemRow
          key={item.url}
          image={item.image}
          title={item.name}
          url={item.url}
          item={{
            name: item.name,
            url: item.url,
            image: item.image,
            price: item.price,
            vendor: item.vendor,
            category: item.category,
          }}
          vendor={item.vendor}
          fallbackIcon="open_in_new"
          badges={[
            ...(item.category ? [{ label: item.category, className: 'px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase' }] : []),
            { label: relativeTime(item.viewedAt), className: '' },
          ]}
          rightTop={formatDisplayPrice(item.price)}
          rightBottom={`${item.viewCount}x`}
        />
      ))}
      <WidgetFooterLink href="/recently-viewed" label="View recently viewed →" />
    </div>
  );
}

function FavoritesWidget() {
  const { favorites, loading } = useFavorites();
  if (loading) return <CompactListSkeleton />;
  if (favorites.length === 0) return <WidgetIconEmptyState icon="favorite" message="No favorites yet." />;
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {favorites.slice(0, 5).map((item) => (
        <DashboardItemRow
          key={item.url}
          image={item.image}
          title={item.name}
          url={item.url}
          item={{
            name: item.name,
            url: item.url,
            image: item.image,
            price: item.price,
            vendor: item.vendor,
            category: item.category,
          }}
          vendor={item.vendor}
          fallbackIcon="favorite"
          badges={item.category ? [{ label: item.category, className: 'px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase' }] : []}
          rightTop={formatDisplayPrice(item.price)}
        />
      ))}
      <WidgetFooterLink href="/favorites" label="View favorites →" />
    </div>
  );
}

function CommunityInsightsWidget({ config }: { config: CommunityWidgetConfig }) {
  const { loading, entries, error } = useCommunityInsights(
    config.metric,
    config.analyticsCategory,
    config.analyticsSubcategory,
    5,
  );

  if (loading) return <SkeletonRows n={4} />;

  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-slate-400 text-sm">
        {error ? <p className="text-red-400 text-xs mb-1">{error}</p> : <p>{config.emptyLabel}</p>}
        <div className="mt-2"><Link href={config.linkHref} className="text-xs font-bold text-blue-500 hover:underline">{config.linkLabel}</Link></div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {entries.map((item) => (
        <DashboardItemRow
          key={item.url}
          image={item.image}
          title={item.name}
          url={item.url}
          item={{
            name: item.name,
            url: item.url,
            image: item.image,
            price: item.price,
            vendor: item.vendor,
            category: item.category,
          }}
          vendor={item.vendor}
          fallbackIcon="trending_up"
          badges={[
            ...(item.analyticsCategory ? [{ label: communityLabel(item.analyticsCategory) ?? item.analyticsCategory, className: 'px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase' }] : []),
            ...(item.analyticsSubcategory ? [{ label: communityLabel(item.analyticsSubcategory) ?? item.analyticsSubcategory, className: 'px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold uppercase' }] : []),
          ]}
          rightTop={formatDisplayPrice(item.price)}
          rightBottom={`${item.uniqueUsers} users`}
          rightBottomSecondary={config.metric === 'views' ? `${item.totalEvents} views` : `${item.totalEvents} saves`}
        />
      ))}
      <WidgetFooterLink href={config.linkHref} label={config.linkLabel} />
    </div>
  );
}

function FeedListWidget({ widgetId, linkHref, linkLabel }: { widgetId: string; linkHref: string; linkLabel: string }) {
  const { loading, items, sources, error } = useFeedData(widgetId);
  if (loading) return <SkeletonRows />;
  const top = items.slice(0, 3);
  if (top.length === 0) {
    const sourceErrors = summarizeSourceErrors(sources, {
      rateLimitLabel: 'Rate limit — scrape cooldown active',
      blockedLabel: 'Source blocked (403)',
    });
    return <FeedWidgetEmptyState error={error} sourceErrors={sourceErrors} emptyLabel="No data available yet." linkHref={linkHref} linkLabel={linkLabel} />;
  }
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {top.map((item, i) => {
        const currentPrice = parseNumericPrice(item.price);
        const price = currentPrice > 0 ? `$${currentPrice.toFixed(0)}` : '—';
        const comparePrice = parseNumericPrice(item.comparePrice);
        const discount = comparePrice > currentPrice && comparePrice > 0
          ? Math.round((1 - currentPrice / comparePrice) * 100)
          : 0;
        const itemKey = item.url ?? `${item._vendor ?? 'vendor'}:${item.name}:${i}`;
        return (
          <FeedProductRow
            key={itemKey}
            name={item.name}
            url={item.url}
            item={item.url ? {
              name: item.name,
              url: item.url,
              image: item.image,
              price,
              vendor: item._vendor,
              category: item._sourceCategory,
            } : undefined}
            vendor={item._vendor}
            price={price}
            badge={discount > 0
              ? {
                  label: `-${discount}%`,
                  className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold',
                }
              : undefined}
          />
        );
      })}
      <WidgetFooterLink href={linkHref} label={linkLabel} />
    </div>
  );
}

function KeyboardReleasesWidget() {
  const { loading, items, sources, error } = useFeedData('keyboard-releases');
  if (loading) return <SkeletonRows />;
  const top = items.slice(0, 5);
  if (top.length === 0) {
    const sourceErrors = summarizeSourceErrors(sources, {
      rateLimitLabel: 'Scrape cooldown active',
      blockedLabel: 'Source blocked (403)',
      maxLen: 50,
    });
    return <FeedWidgetEmptyState error={error} sourceErrors={sourceErrors} emptyLabel="No keyboard data yet." linkHref="/drops" linkLabel="Browse all drops →" />;
  }
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {top.map((item, i) => {
        const currentPrice = parseNumericPrice(item.price);
        const price = currentPrice > 0 ? `$${currentPrice.toFixed(0)}` : '—';
        const normalizedStock = getFeedStockStatus(item);
        const stockStatus =
          normalizedStock === 'out-of-stock' ? 'out' :
          normalizedStock === 'partial-stock' ? 'partial' :
          normalizedStock === 'low-stock' ? 'low' :
          normalizedStock === 'in-stock' ? 'in' :
          'unknown';

        const stockBadge = {
          label: stockStatus === 'out' ? 'Out of Stock' : stockStatus === 'partial' ? 'Limited Stock' : stockStatus === 'low' ? 'Low Stock' : stockStatus === 'in' ? 'In Stock' : 'Stock Unknown',
          className: `px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
            stockStatus === 'out'     ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' :
            stockStatus === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' :
            stockStatus === 'low'     ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' :
            stockStatus === 'in'      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                                         'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`,
        };

        const itemKey = item.url ?? `${item._vendor ?? 'vendor'}:${item.name}:${i}`;

        return (
          <FeedProductRow
            key={itemKey}
            name={item.name}
            url={item.url}
            item={item.url ? {
              name: item.name,
              url: item.url,
              image: item.image,
              price,
              vendor: item._vendor,
              category: item._sourceCategory,
            } : undefined}
            vendor={item._vendor}
            price={price}
            badge={stockBadge}
          />
        );
      })}
      <WidgetFooterLink href="/drops" label="Browse all drops →" />
    </div>
  );
}

function KeyboardComparisonWidget() {
  const { loading, items, sources, error } = useFeedData('keyboard-releases');
  if (loading) return <KeyboardComparisonSkeleton />;

  const displayed = items.slice(0, 2);

  if (displayed.length === 0) {
    const sourceErrors = summarizeSourceErrors(sources, {
      rateLimitLabel: 'Scrape cooldown active',
      blockedLabel: 'Source blocked (403)',
      maxLen: 50,
    });
    return <FeedWidgetEmptyState error={error} sourceErrors={sourceErrors} emptyLabel="No keyboard data yet." linkHref="/keyboard-comparison" linkLabel="Full comparison →" />;
  }

  const getSpecs = (item: ReturnType<typeof useFeedData>['items'][number]) => {
    const tagList = (item.tags ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    return {
      layout:   tagList.find(t => /65%|tkl|full.?size|40%|75%|60%|96%/.test(t)) ?? item.productType ?? '—',
      mount:    tagList.find(t => /gasket|top.?mount|tray|leaf|sandwich/.test(t)) ?? '—',
      pcb:      tagList.find(t => /hotswap|hot.?swap|solder/.test(t)) ?? '—',
      wireless: tagList.some(t => /wireless|bluetooth/.test(t)),
    };
  };

  const SPEC_ROWS = [
    { label: 'Layout',      key: 'layout' },
    { label: 'Mounting',    key: 'mount' },
    { label: 'PCB',         key: 'pcb' },
    { label: 'Wireless',    key: 'wireless' },
    { label: 'Price',       key: 'price' },
  ];

  const cards = displayed.map(item => {
    const specs = getSpecs(item);
    const price = parseNumericPrice(item.price);
    return {
      key: item.url ?? item.name,
      name: item.name,
      vendor: item._vendor,
      values: {
        layout: specs.layout,
        mount: specs.mount,
        pcb: specs.pcb,
        wireless: specs.wireless ? 'Yes' : 'No',
        price: price > 0 ? `$${price.toFixed(0)}` : '—',
      },
    };
  });

  return <KeyboardComparisonTable cards={cards} rows={SPEC_ROWS} />;
}

function InventoryStatsWidget() {
  const { projects, loading } = useProjects();
  if (loading) return <InventoryStatsSkeleton />;
  const activeCount = projects.filter(p => p.status === 'In Progress').length;
  const forSaleCount = projects.filter(p => p.forSale).length;
  const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
  const budgetRemaining = projects.reduce((sum, p) => {
    const b = p.budget ?? 0;
    const s = p.spent || 0;
    return sum + Math.max(0, b - s);
  }, 0);
  const stats: InventoryStat[] = [
    { icon: 'rocket_launch', bg: 'bg-blue-500/10 text-blue-500', label: 'Active Projects', value: String(activeCount), badge: 'In Progress', badgeCls: 'text-blue-500' },
    { icon: 'sell', bg: 'bg-emerald-500/10 text-emerald-500', label: 'For Sale', value: String(forSaleCount), badge: 'Listed', badgeCls: 'text-emerald-500' },
    { icon: 'payments', bg: 'bg-purple-500/10 text-purple-500', label: 'Total Spent', value: `$${totalSpent.toLocaleString()}`, badge: 'All Projects', badgeCls: 'text-slate-500' },
    { icon: 'account_balance_wallet', bg: 'bg-orange-500/10 text-orange-500', label: 'Budget Left', value: `$${budgetRemaining.toLocaleString()}`, badge: 'Remaining', badgeCls: 'text-orange-500' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {stats.map(stat => <InventoryStatCard key={stat.label} stat={stat} />)}
    </div>
  );
}

// ─── WidgetContent router ─────────────────────────────────────────────────────
function WidgetContent({ id }: { id: string }) {
  const communityWidget = COMMUNITY_WIDGET_CONFIG_BY_ID.get(id);
  if (communityWidget) {
    return <CommunityInsightsWidget config={communityWidget} />;
  }

  switch (id) {
    case 'active-projects':    return <ActiveProjectsWidget />;
    case 'recent-activity':    return <RecentActivityWidget />;
    case 'favorite-products':  return <FavoritesWidget />;
    case 'keyboard-releases':  return <KeyboardReleasesWidget />;
    case 'keyboard-full-release': return <FeedListWidget widgetId="keyboard-full-release" linkHref="/keyboards" linkLabel="Browse keyboard catalog →" />;
    case 'keyboard-parts-release': return <FeedListWidget widgetId="keyboard-parts-release" linkHref="/drops" linkLabel="View keyboard parts →" />;
    case 'keyboard-switches': return <FeedListWidget widgetId="keyboard-switches" linkHref="/drops" linkLabel="View keyboard switches →" />;
    case 'keyboard-accessories': return <FeedListWidget widgetId="keyboard-accessories" linkHref="/drops" linkLabel="View keyboard accessories →" />;
    case 'keycaps-tracker':    return <FeedListWidget widgetId="keycap-releases" linkHref="/keycaps-tracker" linkLabel="Open keycaps tracker →" />;
    case 'keyboard-sales':     return <FeedListWidget widgetId="keyboard-sales" linkHref="/active-deals" linkLabel="View all keyboard deals →" />;
    case 'keyboard-comparison': return <KeyboardComparisonWidget />;
    case 'ram-availability':   return <FeedListWidget widgetId="ram-availability" linkHref="/ram-availability-tracker" linkLabel="Open RAM tracker →" />;
    case 'gpu-availability':   return <FeedListWidget widgetId="gpu-availability" linkHref="/gpu-availability-tracker" linkLabel="Open GPU tracker →" />;
    case 'cpu-availability':   return <FeedListWidget widgetId="cpu-availability" linkHref="/cpu-availability-tracker" linkLabel="Open CPU tracker →" />;
    case 'pc-deals':           return <FeedListWidget widgetId="pc-deals" linkHref="/pc-building" linkLabel="View PC Building hub →" />;
    case 'active-deals':       return <FeedListWidget widgetId="active-deals" linkHref="/active-deals" linkLabel="View all deals →" />;
    case 'electronics-watchlist':        return <FeedListWidget widgetId="electronics-watchlist"        linkHref="/electronics" linkLabel="Manage watchlist →" />;
    case 'electronics-new-drops':        return <FeedListWidget widgetId="electronics-new-drops"        linkHref="/electronics" linkLabel="View all new drops →" />;
    case 'electronics-sales':            return <FeedListWidget widgetId="electronics-sales"            linkHref="/electronics" linkLabel="View electronics deals →" />;
    case 'electronics-microcontrollers': return <FeedListWidget widgetId="electronics-microcontrollers" linkHref="/electronics" linkLabel="View MCUs →" />;
    case 'electronics-passives':         return <FeedListWidget widgetId="electronics-passives"         linkHref="/electronics" linkLabel="View passives →" />;
    case 'electronics-sensors':          return <FeedListWidget widgetId="electronics-sensors"          linkHref="/electronics" linkLabel="View sensors →" />;
    case 'electronics-motors':           return <FeedListWidget widgetId="electronics-motors"           linkHref="/electronics" linkLabel="View motors →" />;
    case 'electronics-ics':              return <FeedListWidget widgetId="electronics-ics"              linkHref="/electronics" linkLabel="View ICs →" />;
    case 'electronics-encoders':         return <FeedListWidget widgetId="electronics-encoders"         linkHref="/electronics" linkLabel="View encoders →" />;
    case 'electronics-power':            return <FeedListWidget widgetId="electronics-power"            linkHref="/electronics" linkLabel="View power modules →" />;
    case 'electronics-connectors':       return <FeedListWidget widgetId="electronics-connectors"       linkHref="/electronics" linkLabel="View connectors →" />;
    case 'electronics-displays':         return <FeedListWidget widgetId="electronics-displays"         linkHref="/electronics" linkLabel="View displays →" />;
    case 'electronics-wireless':         return <FeedListWidget widgetId="electronics-wireless"         linkHref="/electronics" linkLabel="View wireless modules →" />;
    case 'electronics-audio':            return <FeedListWidget widgetId="electronics-audio"            linkHref="/electronics" linkLabel="View audio modules →" />;
    case 'inventory-stats':    return <InventoryStatsWidget />;
    case 'vendor-performance':
      return (
        <div className="p-6 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
          <span className="material-symbols-outlined text-3xl">storefront</span>
          <p className="text-sm font-medium">Vendor analytics not yet available.</p>
          <p className="text-xs">Connect vendor order history to enable this widget.</p>
        </div>
      );

    // ─── Garden ──────────────────────────────────────────────────────────────
    case 'garden-new-arrivals':  return <FeedListWidget widgetId="garden-new-arrivals"  linkHref="/garden" linkLabel="Browse garden arrivals →" />;
    case 'garden-deals':         return <FeedListWidget widgetId="garden-deals"         linkHref="/garden" linkLabel="View garden deals →" />;
    case 'garden-houseplants':   return <FeedListWidget widgetId="garden-houseplants"   linkHref="/garden" linkLabel="Browse houseplants →" />;
    case 'garden-trees-shrubs':  return <FeedListWidget widgetId="garden-trees-shrubs"  linkHref="/garden" linkLabel="Browse trees & shrubs →" />;
    case 'garden-perennials':    return <FeedListWidget widgetId="garden-perennials"    linkHref="/garden" linkLabel="Browse perennials →" />;
    case 'garden-seeds':         return <FeedListWidget widgetId="garden-seeds"         linkHref="/garden" linkLabel="Browse seeds →" />;
    case 'garden-tools':         return <FeedListWidget widgetId="garden-tools"         linkHref="/garden" linkLabel="Browse garden tools →" />;

    // ─── Groceries ───────────────────────────────────────────────────────────
    case 'grocery-deals':        return <FeedListWidget widgetId="grocery-deals"        linkHref="/groceries" linkLabel="View weekly deals →" />;
    case 'grocery-produce':      return <FeedListWidget widgetId="grocery-produce"      linkHref="/groceries" linkLabel="Browse fresh produce →" />;
    case 'grocery-staples':      return <FeedListWidget widgetId="grocery-staples"      linkHref="/groceries" linkLabel="Browse pantry staples →" />;
    case 'grocery-meat-seafood': return <FeedListWidget widgetId="grocery-meat-seafood" linkHref="/groceries" linkLabel="Browse meat & seafood →" />;

    // ─── Sports ──────────────────────────────────────────────────────────────
    case 'sports-baseball':      return <FeedListWidget widgetId="sports-baseball"      linkHref="/sports" linkLabel="Browse baseball gear →" />;
    case 'sports-basketball':    return <FeedListWidget widgetId="sports-basketball"    linkHref="/sports" linkLabel="Browse basketball gear →" />;
    case 'sports-football':      return <FeedListWidget widgetId="sports-football"      linkHref="/sports" linkLabel="Browse football gear →" />;
    case 'sports-soccer':        return <FeedListWidget widgetId="sports-soccer"        linkHref="/sports" linkLabel="Browse soccer gear →" />;
    case 'sports-volleyball':    return <FeedListWidget widgetId="sports-volleyball"    linkHref="/sports" linkLabel="Browse volleyball gear →" />;
    case 'sports-deals':         return <FeedListWidget widgetId="sports-deals"         linkHref="/sports" linkLabel="View sports deals →" />;
    case 'sports-new-releases':  return <FeedListWidget widgetId="sports-new-releases"  linkHref="/sports" linkLabel="View new equipment →" />;

    // ─── 3D Printing ─────────────────────────────────────────────────────────
    case '3dp-printers':         return <FeedListWidget widgetId="3dp-printers"         linkHref="/3d-printing" linkLabel="Browse 3D printers →" />;
    case '3dp-filament':         return <FeedListWidget widgetId="3dp-filament"         linkHref="/3d-printing" linkLabel="Browse filament →" />;
    case '3dp-resins':           return <FeedListWidget widgetId="3dp-resins"           linkHref="/3d-printing" linkLabel="Browse resins →" />;
    case '3dp-accessories':      return <FeedListWidget widgetId="3dp-accessories"      linkHref="/3d-printing" linkLabel="Browse accessories →" />;
    case '3dp-deals':            return <FeedListWidget widgetId="3dp-deals"            linkHref="/3d-printing" linkLabel="View 3D printing deals →" />;

    // ─── Automotive ──────────────────────────────────────────────────────────
    case 'auto-parts':           return <FeedListWidget widgetId="auto-parts"           linkHref="/automotive" linkLabel="Browse auto parts →" />;
    case 'auto-tools':           return <FeedListWidget widgetId="auto-tools"           linkHref="/automotive" linkLabel="Browse tools & equipment →" />;
    case 'auto-accessories':     return <FeedListWidget widgetId="auto-accessories"     linkHref="/automotive" linkLabel="Browse car accessories →" />;
    case 'auto-deals':           return <FeedListWidget widgetId="auto-deals"           linkHref="/automotive" linkLabel="View auto deals →" />;

    // ─── Games ───────────────────────────────────────────────────────────────
    case 'games-video-deals':    return <FeedListWidget widgetId="games-video-deals"    linkHref="/games" linkLabel="View video game deals →" />;
    case 'games-video-new':      return <FeedListWidget widgetId="games-video-new"      linkHref="/games" linkLabel="Browse new video games →" />;
    case 'games-board-new':      return <FeedListWidget widgetId="games-board-new"      linkHref="/games" linkLabel="Browse new board games →" />;
    case 'games-board-deals':    return <FeedListWidget widgetId="games-board-deals"    linkHref="/games" linkLabel="View board game deals →" />;
    case 'games-tabletop':       return <FeedListWidget widgetId="games-tabletop"       linkHref="/games" linkLabel="Browse tabletop & RPG →" />;
    case 'games-deals':          return <FeedListWidget widgetId="games-deals"          linkHref="/games" linkLabel="View all games deals →" />;

    // ─── Home ────────────────────────────────────────────────────────────────
    case 'home-decor':           return <FeedListWidget widgetId="home-decor"           linkHref="/home" linkLabel="Browse home decor →" />;
    case 'home-furniture':       return <FeedListWidget widgetId="home-furniture"       linkHref="/home" linkLabel="Browse furniture →" />;
    case 'home-kitchen':         return <FeedListWidget widgetId="home-kitchen"         linkHref="/home" linkLabel="Browse kitchen & appliances →" />;
    case 'home-deals':           return <FeedListWidget widgetId="home-deals"           linkHref="/home" linkLabel="View home deals →" />;

    // ─── Home Improvement ────────────────────────────────────────────────────
    case 'homeimprove-tools':      return <FeedListWidget widgetId="homeimprove-tools"      linkHref="/home-improvement" linkLabel="Browse power & hand tools →" />;
    case 'homeimprove-materials':  return <FeedListWidget widgetId="homeimprove-materials"  linkHref="/home-improvement" linkLabel="Browse building materials →" />;
    case 'homeimprove-plumbing':   return <FeedListWidget widgetId="homeimprove-plumbing"   linkHref="/home-improvement" linkLabel="Browse plumbing →" />;
    case 'homeimprove-electrical': return <FeedListWidget widgetId="homeimprove-electrical" linkHref="/home-improvement" linkLabel="Browse electrical →" />;
    case 'homeimprove-deals':      return <FeedListWidget widgetId="homeimprove-deals"      linkHref="/home-improvement" linkLabel="View DIY deals →" />;

    // ─── Clothes ─────────────────────────────────────────────────────────────
    case 'clothes-mens':         return <FeedListWidget widgetId="clothes-mens"         linkHref="/clothes" linkLabel="Browse men's clothing →" />;
    case 'clothes-womens':       return <FeedListWidget widgetId="clothes-womens"       linkHref="/clothes" linkLabel="Browse women's clothing →" />;
    case 'clothes-activewear':   return <FeedListWidget widgetId="clothes-activewear"   linkHref="/clothes" linkLabel="Browse activewear →" />;
    case 'clothes-deals':        return <FeedListWidget widgetId="clothes-deals"        linkHref="/clothes" linkLabel="View clothing deals →" />;
    case 'clothes-new':          return <FeedListWidget widgetId="clothes-new"          linkHref="/clothes" linkLabel="Browse new arrivals →" />;

    // ─── Shoes ───────────────────────────────────────────────────────────────
    case 'shoes-athletic':       return <FeedListWidget widgetId="shoes-athletic"       linkHref="/shoes" linkLabel="Browse athletic shoes →" />;
    case 'shoes-casual':         return <FeedListWidget widgetId="shoes-casual"         linkHref="/shoes" linkLabel="Browse casual shoes →" />;
    case 'shoes-deals':          return <FeedListWidget widgetId="shoes-deals"          linkHref="/shoes" linkLabel="View shoe deals →" />;
    case 'shoes-new':            return <FeedListWidget widgetId="shoes-new"            linkHref="/shoes" linkLabel="Browse new releases →" />;

    // ─── Art ─────────────────────────────────────────────────────────────────
    case 'art-supplies-new':     return <FeedListWidget widgetId="art-supplies-new"     linkHref="/art" linkLabel="Browse new art supplies →" />;
    case 'art-supplies-deals':   return <FeedListWidget widgetId="art-supplies-deals"   linkHref="/art" linkLabel="View art supply deals →" />;
    case 'art-prints':           return <FeedListWidget widgetId="art-prints"           linkHref="/art" linkLabel="Browse prints & originals →" />;

    // ─── Crafts ──────────────────────────────────────────────────────────────
    case 'crafts-pottery':       return <FeedListWidget widgetId="crafts-pottery"       linkHref="/crafts" linkLabel="Browse pottery supplies →" />;
    case 'crafts-weaving':       return <FeedListWidget widgetId="crafts-weaving"       linkHref="/crafts" linkLabel="Browse weaving supplies →" />;
    case 'crafts-deals':         return <FeedListWidget widgetId="crafts-deals"         linkHref="/crafts" linkLabel="View craft deals →" />;

    // ─── Needle Work ─────────────────────────────────────────────────────────
    case 'needlework-knitting':  return <FeedListWidget widgetId="needlework-knitting"  linkHref="/needle-work" linkLabel="Browse knitting supplies →" />;
    case 'needlework-crochet':   return <FeedListWidget widgetId="needlework-crochet"   linkHref="/needle-work" linkLabel="Browse crochet supplies →" />;
    case 'needlework-quilting':  return <FeedListWidget widgetId="needlework-quilting"  linkHref="/needle-work" linkLabel="Browse quilting supplies →" />;
    case 'needlework-deals':     return <FeedListWidget widgetId="needlework-deals"     linkHref="/needle-work" linkLabel="View needle work deals →" />;

    // ─── Finance ─────────────────────────────────────────────────────────────
    case 'finance-recent-transactions': return <FinanceRecentTransactionsWidget />;
    case 'finance-budget':              return <FinanceBudgetWidget />;
    case 'finance-spend-by-category':   return <FinanceSpendByCategoryWidget />;

    default:
      return <div className="p-4 text-sm text-slate-500">No content yet.</div>;
  }
}

// ─── Widget card ──────────────────────────────────────────────────────────────
const AGO_LABELS = ['2 min ago', '17 hr ago', '5 min ago', '1 hr ago', '3 hr ago'];

function WidgetCard({ def, onRemove, ageIdx, editMode }: { def: WidgetDef; onRemove: () => void; ageIdx: number; editMode: boolean }) {
  const ago = AGO_LABELS[ageIdx % AGO_LABELS.length];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: def.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {editMode && (
            <span
              {...attributes}
              {...listeners}
              className="material-symbols-outlined text-[18px] text-slate-400 cursor-grab active:cursor-grabbing hover:text-blue-500 transition-colors"
              title="Drag to reorder"
            >drag_indicator</span>
          )}
          <span className={`material-symbols-outlined text-[18px] ${def.color}`}>{def.icon}</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">{def.title}</h3>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-[10px] hidden sm:inline">{ago}</span>
          <button className="hover:text-blue-500 transition-colors p-1" title="Expand">
            <span className="material-symbols-outlined text-[16px]">open_in_full</span>
          </button>
          <button onClick={onRemove} className="hover:text-red-500 transition-colors p-1" title="Remove">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
      <div className="flex-1">
        <WidgetContent id={def.id} />
      </div>
    </div>
  );
}

// ─── Widget picker panel ──────────────────────────────────────────────────────
function WidgetPicker({ onToggle, onClose, active }: { onToggle: (id: string) => void; onClose: () => void; active: string[] }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All');

  const categories = ['All', ...Array.from(new Set(ALL_WIDGETS.map(w => w.category)))];
  const filtered = ALL_WIDGETS.filter(w => {
    const matchTab = tab === 'All' || w.category === tab;
    const matchSearch = !search || w.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const grouped = categories
    .filter(c => c !== 'All')
    .map(cat => ({ cat, widgets: filtered.filter(w => w.category === cat) }))
    .filter(g => g.widgets.length > 0);

  const displayGroups = tab === 'All' ? grouped : grouped.filter(g => g.cat === tab);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold">Widget Manager</h2>
            <p className="text-xs text-slate-500">{active.length} of {ALL_WIDGETS.length} widgets active</p>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors">
            <span className="material-symbols-outlined text-[16px]">check</span>Done
          </button>
        </div>

        {/* search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search widgets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === c ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-blue-500'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {displayGroups.map(({ cat, widgets }) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{cat} ({widgets.length})</p>
              <div className="grid grid-cols-1 gap-3">
                {widgets.map(w => {
                  const isActive = active.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      className={`flex items-start justify-between p-4 rounded-xl border transition-all ${isActive ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/20'}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <span className={`material-symbols-outlined text-[18px] ${isActive ? w.color : 'text-slate-400'}`}>{w.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{w.title}</p>
                            {isActive && <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">active</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggle(w.id)}
                        className={`ml-3 shrink-0 flex items-center justify-center size-8 rounded-lg font-bold transition-colors ${isActive ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-100 hover:text-red-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        title={isActive ? 'Remove' : 'Add'}
                      >
                        <span className="material-symbols-outlined text-[18px]">{isActive ? 'remove' : 'add'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Layout dropdown ──────────────────────────────────────────────────────────
function LayoutPanel({ cols, setCols, onClose }: { cols: 2 | 3 | 4; setCols: (c: 2 | 3 | 4) => void; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Layout Options</p>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 pt-1 pb-2">Columns</p>
        {([2, 3, 4] as const).map(n => (
          <button
            key={n}
            onClick={() => { setCols(n); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${cols === n ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {n === 2 ? 'view_column' : n === 3 ? 'view_week' : 'view_module'}
            </span>
            {n} Columns{cols === n ? ' ✓' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Data / Feeds dropdown ────────────────────────────────────────────────────
function DataPanel() {
  const feeds = [
    { cat: 'RAM Availability', items: [
      { name: 'Newegg RAM Stock', source: 'Newegg', interval: '15 min', status: 'online' as const },
      { name: 'Amazon RAM Prices', source: 'Amazon', interval: '30 min', status: 'online' as const },
      { name: 'TigerDirect RAM Feed', source: 'TigerDirect', interval: '30 min', status: 'online' as const },
      { name: 'Mouser Stock Feed', source: 'Mouser API', interval: '15 min', status: 'online' as const },
      { name: 'DigiKey Product Feed', source: 'DigiKey API', interval: '15 min', status: 'online' as const },
    ]},
    { cat: 'GPU Availability', items: [
      { name: 'Newegg GPU Stock', source: 'Newegg', interval: '10 min', status: 'online' as const },
      { name: 'Amazon GPU Prices', source: 'Amazon', interval: '30 min', status: 'online' as const },
      { name: 'TigerDirect GPU Feed', source: 'TigerDirect', interval: '30 min', status: 'queued' as const },
    ]},
    { cat: 'Keyboards', items: [
      { name: 'geekhack Group Buys', source: 'geekhack.org', interval: '1 hr', status: 'online' as const },
      { name: 'KBDfans Sales', source: 'KBDfans', interval: '6 hr', status: 'queued' as const },
      { name: 'Novelkeys Releases', source: 'Novelkeys', interval: '6 hr', status: 'static' as const },
      { name: 'Stupid Bullets Tech', source: 'stupidbulletstech.com', interval: '6 hr', status: 'queued' as const },
      { name: 'Custom Keys Co.', source: 'customkeysco.com', interval: '6 hr', status: 'queued' as const },
    ]},
    { cat: 'Deals', items: [
      { name: 'Amazon Deal Tracker', source: 'Amazon', interval: '30 min', status: 'online' as const },
      { name: 'Slickdeals Feed', source: 'Slickdeals', interval: '5 min', status: 'online' as const },
    ]},
  ];
  const statusDot: Record<string, string> = { online: 'bg-emerald-500', queued: 'bg-blue-500', static: 'bg-slate-400', error: 'bg-red-500' };
  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <p className="text-xs font-bold text-slate-700 dark:text-white">Sources &amp; Status</p>
        <p className="text-[10px] text-slate-500">Data feeds from tracked providers</p>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-slate-200 dark:divide-slate-800">
        {feeds.map(g => (
          <div key={g.cat} className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{g.cat}</p>
            <div className="space-y-2">
              {g.items.map(f => (
                <div key={f.name} className="flex items-center gap-2">
                  <div className={`size-1.5 rounded-full shrink-0 ${statusDot[f.status]}`} />
                  <div>
                    <p className="text-xs font-medium">{f.name}</p>
                    <p className="text-[10px] text-slate-500">{f.source} · {f.interval}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const STORAGE_KEY_WIDGETS = 'sd-active-widgets';
const STORAGE_KEY_COLS = 'sd-grid-cols';
const DEFAULT_WIDGETS = ['inventory-stats', 'active-projects', 'recent-activity', 'favorite-products', 'keyboard-releases', 'ram-availability', 'active-deals'];

export default function Dashboard() {
  const router = useRouter();
  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>(DEFAULT_WIDGETS);
  const [cols, setCols] = useState<2 | 3 | 4>(3);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const PC_BUILDING_LINKS = [
    { href: '/pc-building',              label: 'PC Building Hub', icon: 'computer' },
    { href: '/cpu-availability-tracker', label: 'CPU',             icon: 'memory_alt' },
    { href: '/ram-availability-tracker', label: 'RAM',             icon: 'memory' },
    { href: '/gpu-availability-tracker', label: 'GPU',             icon: 'videogame_asset' },
  ];

  const KEYBOARD_LINKS = [
    { href: '/keyboard-comparison', label: 'Keyboards',  icon: 'compare' },
    { href: '/keycaps-tracker',     label: 'Keycaps',    icon: 'format_color_text' },
  ];

  const DASH_DRAWER_LINKS = [
    { href: '/community-insights',      label: 'Community Insights', icon: 'insights' },
    { href: '/recently-viewed',         label: 'Recently Viewed', icon: 'history' },
    { href: '/favorites',               label: 'Favorites', icon: 'favorite' },
    { href: '/electronics',              label: 'Electronics', icon: 'inventory_2' },
  ];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setActiveWidgetIds(prev => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      const next = arrayMove(prev, oldIdx, newIdx);
      if (getToken()) apiPatch('/api/profile', { widgetOrder: next }).catch(() => {});
      return next;
    });
  }
  const [now, setNow] = useState<Date | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const layoutRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  // Guard: don't persist state until after the initial hydration completes,
  // otherwise the DEFAULT_WIDGETS initializer overwrites what onboarding saved.
  const hydratedRef = useRef(false);

  // Hydrate from API profile then localStorage fallback after mount
  useEffect(() => {
    setNow(new Date());
    const localUser = getUser();
    if (localUser) setUsername(localUser.username);
    if (getToken()) {
      apiGet<{ profile: { activeWidgets?: string[]; gridCols?: number } }>('/api/profile')
        .then(({ profile }) => {
          const demo = isDemoAccount();
          const justOnboarded = localStorage.getItem('sd-onboarding-complete') === 'true';
          if (justOnboarded) localStorage.removeItem('sd-onboarding-complete');
          if (demo || justOnboarded) {
            try {
              const w = localStorage.getItem(STORAGE_KEY_WIDGETS);
              if (w) setActiveWidgetIds(JSON.parse(w));
              const c = localStorage.getItem(STORAGE_KEY_COLS);
              if (c) setCols(Number(c) as 2 | 3 | 4);
            } catch {}
          } else {
            if (profile.activeWidgets?.length) setActiveWidgetIds(profile.activeWidgets);
            if (profile.gridCols) setCols(profile.gridCols as 2 | 3 | 4);
          }
        })
        .catch(() => {
          // Fall back to localStorage if API unavailable
          try {
            const w = localStorage.getItem(STORAGE_KEY_WIDGETS);
            if (w) setActiveWidgetIds(JSON.parse(w));
            const c = localStorage.getItem(STORAGE_KEY_COLS);
            if (c) setCols(Number(c) as 2 | 3 | 4);
          } catch {}
        })
        .finally(() => { hydratedRef.current = true; });
    } else {
      try {
        const w = localStorage.getItem(STORAGE_KEY_WIDGETS);
        if (w) setActiveWidgetIds(JSON.parse(w));
        const c = localStorage.getItem(STORAGE_KEY_COLS);
        if (c) setCols(Number(c) as 2 | 3 | 4);
      } catch {}
      hydratedRef.current = true;
    }
  }, []);

  // Persist widget selection — skip until hydration is done
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(activeWidgetIds));
    if (getToken()) {
      apiPatch('/api/profile', { activeWidgets: activeWidgetIds }).catch(() => {});
    }
  }, [activeWidgetIds]);

  // Persist column count — skip until hydration is done
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(STORAGE_KEY_COLS, String(cols));
    if (getToken()) {
      apiPatch('/api/profile', { gridCols: cols }).catch(() => {});
    }
  }, [cols]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close panels on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) setShowLayoutPanel(false);
      if (dataRef.current && !dataRef.current.contains(e.target as Node)) setShowDataPanel(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [router.pathname]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  const toggleWidget = (id: string) =>
    setActiveWidgetIds(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);

  const removeWidget = (id: string) =>
    setActiveWidgetIds(prev => prev.filter(w => w !== id));

  const activeWidgets = activeWidgetIds
    .map(id => ALL_WIDGETS.find(w => w.id === id))
    .filter(Boolean) as WidgetDef[];

  const colClass: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const timeStr = now?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '';
  const dateStr = now?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? '';

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">

      {/* ── Toolbar ── */}
      <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-[#f5f7f8] dark:bg-[#101922] px-4 z-30 shrink-0 gap-4">
        {/* Left: logo + hamburger + nav */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-blue-500 font-bold shrink-0">
            <div className="size-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
            </div>
            <span className="text-base hidden sm:block">ShopDeck</span>
          </Link>
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(o => !o)}
            title="More pages"
            className={`p-2 rounded-lg transition-colors ${drawerOpen ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{drawerOpen ? 'close' : 'menu'}</span>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
              { href: '/projects', label: 'Projects', icon: 'rocket_launch' },
              { href: '/active-deals', label: 'Deals', icon: 'sell' },
              { href: '/drops', label: 'Drops', icon: 'new_releases' },
            ].map(n => (
              <Link key={n.href} href={n.href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-blue-500 hover:bg-blue-500/5 transition-colors">
                <span className="material-symbols-outlined text-[16px]">{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Center: clock */}
        {now && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <span>{dateStr}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{timeStr}</span>
          </div>
        )}

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Layout dropdown */}
          <div className="relative" ref={layoutRef}>
            <button
              onClick={() => { setShowLayoutPanel(v => !v); setShowDataPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showLayoutPanel ? 'border-blue-500 bg-blue-500/5 text-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500/50'}`}
            >
              <span className="material-symbols-outlined text-[16px]">view_column</span>
              <span className="hidden sm:inline">Layout</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showLayoutPanel && <LayoutPanel cols={cols} setCols={setCols} onClose={() => setShowLayoutPanel(false)} />}
          </div>

          {/* Data / Feeds dropdown */}
          <div className="relative" ref={dataRef}>
            <button
              onClick={() => { setShowDataPanel(v => !v); setShowLayoutPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showDataPanel ? 'border-blue-500 bg-blue-500/5 text-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500/50'}`}
            >
              <span className="material-symbols-outlined text-[16px]">rss_feed</span>
              <span className="hidden sm:inline">Data</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showDataPanel && <DataPanel />}
          </div>

          {/* AI Assistant */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('sd:open-ai'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-blue-500 hover:border-blue-500/50 transition-colors"
            title="AI Assistant"
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            <span className="hidden lg:inline">AI</span>
          </button>

          {/* Edit / Reorder mode */}
          <button
            onClick={() => setEditMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${editMode ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-blue-500/50'}`}
            title="Edit / reorder widgets"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="hidden lg:inline">{editMode ? 'Done' : 'Edit'}</span>
          </button>

          {/* Add Widget */}
          <button
            onClick={() => setShowWidgetPicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/30"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span className="hidden sm:inline">Add Widget</span>
          </button>

          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500"></span>
          </Link>

          {/* User avatar / logout */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500/50 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
              <span className="hidden sm:inline max-w-20 truncate">{username ?? 'Account'}</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50">
                <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <span className="material-symbols-outlined text-[16px]">settings</span>Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hamburger drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed top-14 left-0 bottom-0 z-40 w-64 bg-white dark:bg-[#101922] border-r border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-y-auto">
            <div className="px-4 pt-5 pb-2">
              {/* Main nav links — only shown in drawer on smaller screens */}
              <div className="md:hidden mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Main</p>
                <nav className="space-y-0.5">
                  {[
                    { href: '/dashboard',    label: 'Dashboard', icon: 'grid_view' },
                    { href: '/projects',     label: 'Projects',  icon: 'rocket_launch' },
                    { href: '/active-deals', label: 'Deals',     icon: 'sell' },
                    { href: '/drops',        label: 'Drops',     icon: 'new_releases' },
                  ].map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        router.pathname === l.href
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">PC Building</p>
              <nav className="space-y-0.5 mb-4">
                {PC_BUILDING_LINKS.map(l => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </nav>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Keyboards</p>
              <nav className="space-y-0.5 mb-4">
                {KEYBOARD_LINKS.map(l => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </nav>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Trackers</p>
              <nav className="space-y-0.5">
                {DASH_DRAWER_LINKS.map(l => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-auto px-4 pb-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
              <button
                onClick={() => { setDrawerOpen(false); document.dispatchEvent(new CustomEvent('sd:open-ai')); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-blue-500">smart_toy</span>
                AI Assistant
              </button>
              <Link
                href="/settings"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">settings</span>
                Settings
              </Link>
            </div>
          </aside>
        </>
      )}

      {/* ── Widget grid ── */}
      <main className="flex-1 p-4 pb-20 md:pb-4">
        {activeWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <span className="material-symbols-outlined text-8xl text-slate-300 dark:text-slate-700">dashboard_customize</span>
            <div>
              <h2 className="text-xl font-bold mb-2">No widgets on deck</h2>
              <p className="text-slate-500 text-sm mb-6">Add widgets to start monitoring your inventory and projects.</p>
              <button
                onClick={() => setShowWidgetPicker(true)}
                className="flex items-center gap-2 mx-auto px-5 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
              >
                <span className="material-symbols-outlined">add</span>Add Widgets
              </button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={activeWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
          <div className={`grid ${colClass[cols]} gap-4 auto-rows-min`}>
            {editMode && (
              <div className="col-span-full flex items-center gap-2 text-xs text-blue-500 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-2">
                <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                Drag widgets to reorder. Click <strong>Done</strong> when finished.
              </div>
            )}
            {activeWidgets.map((w, i) => (
              <WidgetCard key={w.id} def={w} onRemove={() => removeWidget(w.id)} ageIdx={i} editMode={editMode} />
            ))}
            {/* Add-widget tile */}
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 text-slate-400 hover:border-blue-500/50 hover:text-blue-500 transition-colors min-h-30"
            >
              <span className="material-symbols-outlined text-3xl">add_circle</span>
              <span className="text-xs font-bold">Add Widget</span>
            </button>
          </div>
          </SortableContext>
          </DndContext>
        )}
      </main>

      {/* AI Agent panel is mounted globally in _app.tsx */}

      {/* Widget picker panel */}
      {showWidgetPicker && (
        <WidgetPicker
          onToggle={toggleWidget}
          onClose={() => setShowWidgetPicker(false)}
          active={activeWidgetIds}
        />
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-6 pb-5 pt-3 flex justify-between items-center">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-blue-500">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link href="/projects" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">Projects</span>
        </Link>
        <button
          onClick={() => setShowWidgetPicker(true)}
          className="flex flex-col items-center justify-center -mt-8 size-14 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30"
        >
          <span className="material-symbols-outlined mt-3">add</span>
        </button>
        <Link href="/electronics" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="text-[10px] font-bold">Inventory</span>
        </Link>
        <Link href="/onboarding" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
