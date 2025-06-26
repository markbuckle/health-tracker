import easyocr

reader = easyocr.Reader(['en'])
result = reader.readtext('images/ElizabethAveBloodwork#1.jpg')

for (bbox, text, prob) in result:
    print(text)