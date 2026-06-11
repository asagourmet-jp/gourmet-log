// Mock data for UI preview (no Supabase needed)
export const MOCK_STORES = [
  {
    id: '1',
    name: '一蘭 渋谷店',
    genre: 'ラーメン',
    area: '渋谷',
    rating: 5,
    tabelog_url: 'https://tabelog.com/',
    review_text: '濃厚な豚骨スープが絶品。カスタマイズできるのが嬉しい。麺の硬さは「硬め」が個人的ベスト。一人用の仕切りがあるので一人でも入りやすい。',
    tabelog_status: 'posted',
    instagram_status: 'not_posted',
    photos: [
      { id: 'p1', store_id: '1', storage_path: null, sort_order: 0, _mockUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80' },
      { id: 'p2', store_id: '1', storage_path: null, sort_order: 1, _mockUrl: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=600&q=80' },
    ],
  },
  {
    id: '2',
    name: 'すし 銀座 おのでら',
    genre: '寿司',
    area: '銀座',
    rating: 5,
    tabelog_url: 'https://tabelog.com/',
    review_text: '江戸前の仕事が光る本格派。シャリの温度と酢加減が絶妙。特にトロとウニが最高だった。コースのコスパも◎',
    tabelog_status: 'posted',
    instagram_status: 'posted',
    photos: [
      { id: 'p3', store_id: '2', storage_path: null, sort_order: 0, _mockUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&q=80' },
    ],
  },
  {
    id: '3',
    name: 'PIZZA 4P\'S 渋谷',
    genre: 'イタリアン',
    area: '渋谷',
    rating: 4,
    tabelog_url: null,
    review_text: '生地がもちもちで最高。ハーフ&ハーフが選べるので色々試せる。',
    tabelog_status: 'not_posted',
    instagram_status: 'not_posted',
    photos: [
      { id: 'p4', store_id: '3', storage_path: null, sort_order: 0, _mockUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80' },
      { id: 'p5', store_id: '3', storage_path: null, sort_order: 1, _mockUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80' },
      { id: 'p6', store_id: '3', storage_path: null, sort_order: 2, _mockUrl: 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=600&q=80' },
    ],
  },
  {
    id: '4',
    name: '焼肉 ライク 新宿店',
    genre: '焼肉',
    area: '新宿',
    rating: 3,
    tabelog_url: 'https://tabelog.com/',
    review_text: '一人焼肉の先駆け。タレが自家製で美味しい。ランチタイムはコスパ最強。',
    tabelog_status: 'not_posted',
    instagram_status: 'posted',
    photos: [
      { id: 'p7', store_id: '4', storage_path: null, sort_order: 0, _mockUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80' },
    ],
  },
  {
    id: '5',
    name: 'Blue Bottle Coffee 青山',
    genre: 'カフェ',
    area: '青山',
    rating: 4,
    tabelog_url: null,
    review_text: 'シングルオリジンのコーヒーが丁寧に淹れられている。空間もおしゃれで落ち着く。',
    tabelog_status: 'not_posted',
    instagram_status: 'not_posted',
    photos: [
      { id: 'p8', store_id: '5', storage_path: null, sort_order: 0, _mockUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80' },
    ],
  },
  {
    id: '6',
    name: '鳥貴族 池袋東口店',
    genre: '居酒屋',
    area: '池袋',
    rating: 4,
    tabelog_url: 'https://tabelog.com/',
    review_text: '全品298円の安心感。焼き鳥のクオリティが高い。特に「貴族焼き」がおすすめ。',
    tabelog_status: 'posted',
    instagram_status: 'not_posted',
    photos: [],
  },
];

export function getMockPhotoUrl(photo) {
  return photo._mockUrl || null;
}
