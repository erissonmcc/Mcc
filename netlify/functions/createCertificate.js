const { admin } = require('./firebaseAdmin');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  try {
    // Obtém o nome completo do usuário a partir do corpo da solicitação
    const fullName = 'ERISSIN MIQUEIAS COSTA CALHEIROS';

    // Carrega o PDF base
    const pdfBytes = await fs.promises.readFile(path.resolve(__dirname, 'certificado.pdf'));
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Busca o formulário de texto "FULLNAME" no PDF
    const formTextField = pdfDoc.getForm().getTextField('FULLNAME');
    if (formTextField) {
      // Substitui o valor do formulário de texto pelo nome completo
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
