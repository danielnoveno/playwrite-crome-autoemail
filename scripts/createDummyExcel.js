const xlsx = require('xlsx');

const data = [
  {
    'To Email': 'test1@example.com',
    'Subject': 'Contoh Subject 1',
    'Template': 'template1',
    'Category': 'Test',
    'Company': 'Perusahaan A',
    'Website': 'perusahaanA.com'
  },
  {
    'To Email': 'test2@example.com',
    'Subject': 'Contoh Subject 2',
    'Template': 'template1',
    'Category': 'Test',
    'Company': 'Perusahaan B',
    'Website': 'perusahaanB.com'
  }
];

const worksheet = xlsx.utils.json_to_sheet(data);
const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
xlsx.writeFile(workbook, "D:\\Playwrite+Chrome\\data\\schedule_tracker.xlsx");
console.log("Dummy Excel file created.");
