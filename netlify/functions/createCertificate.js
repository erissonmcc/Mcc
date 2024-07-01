const { admin } = require('./firebaseAdmin');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const fullName = "ERISSON MIQUEIAS COSTA CALHEIROS"; // Nome completo para o certificado

  try {
    // Caminho absoluto para o arquivo PDF
    const pdfPath = path.resolve(__dirname, 'certificado.pdf');

    // Carrega o PDF base usando createReadStream para garantir o caminho correto
    const pdfBytes = await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(pdfPath);
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (error) => reject(error));
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Encontra e preenche o campo de formulário "FULLNAME"
    const formTextField = pdfDoc.getForm().getTextField('FULLNAME');
    if (formTextField) {
      formTextField.setText(fullName);
    } else {
      throw new Error('Campo de formulário "FULLNAME" não encontrado no PDF.');
    }

    // Salva o PDF modificado
    const modifiedPdfBytes = await pdfDoc.save();

    // Salva o PDF no Firebase Storage
    const storage = admin.storage();
    const bucket = storage.bucket();
    const file = bucket.file(`certificados/${fullName}.pdf`);

    await file.save(modifiedPdfBytes, {
      contentType: 'application/pdf',
    });

    console.log(`Certificado para ${fullName} gerado e salvo no Firebase Storage.`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Certificado para ${fullName} gerado e salvo.` }),
    };
  } catch (error) {
    console.error('Erro ao gerar ou salvar o certificado:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Erro ao gerar ou salvar o certificado: ${error.message}` }),
    };
  }
};
