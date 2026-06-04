import { NextRequest, NextResponse } from 'next/server';
import { annotateExcel } from '@/lib/report/annotatedExcel';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Get the original Excel file
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' }, 
        { status: 400 }
      );
    }

    // Get the validation report
    const reportJson = formData.get('report') as string;
    if (!reportJson) {
      return NextResponse.json(
        { error: 'No validation report provided' },
        { status: 400 }
      );
    }

    const report = JSON.parse(reportJson);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Annotate the Excel
    const annotatedBuffer = await annotateExcel(fileBuffer, report);

    // Return as downloadable file
    const originalName = file.name.replace('.xlsx', '').replace('.xls', '');
    const filename = `${originalName}_validated.xlsx`;

    return new NextResponse(annotatedBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('Annotated Excel error:', err);
    return NextResponse.json(
      { error: 'Failed to generate annotated Excel' },
      { status: 500 }
    );
  }
}
